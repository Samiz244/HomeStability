import Groq from 'groq-sdk'
import { HOUSING_COUNSELOR_PROMPT } from '../prompts/housingCounselorPrompt.js'

const MODELS = [
  process.env.GROQ_MODEL,
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
].filter(Boolean)
const apiKey = process.env.GROQ_API_KEY

// Single client instance, created only when a key is present.
const groq = apiKey ? new Groq({ apiKey }) : null

export function isGroqEnabled() {
  return Boolean(groq)
}

/**
 * Low-level chat completion. Groq is OpenAI-compatible:
 *   groq.chat.completions.create({ model, messages })
 * (Not the Anthropic-style messages.create / content[0].text.)
 */
async function complete({ messages, maxTokens = 600, temperature = 0.5, json = false }) {
  let lastError = null

  for (const model of MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        // Do NOT use response_format JSON mode.
        // Some Groq models fail strict JSON validation.
        // We parse JSON manually later with parseJson().
      })

      console.log(`Groq model used: ${model}${json ? ' (manual JSON parsing)' : ''}`)
      return completion.choices[0]?.message?.content ?? ''
    } catch (error) {
      lastError = error

      const status = error?.status
      const code = error?.error?.error?.code || error?.code
      const message = error?.error?.error?.message || error?.message || ''

      const shouldTryNext =
        status === 429 ||
        status === 400 ||
        code === 'rate_limit_exceeded' ||
        code === 'json_validate_failed' ||
        code === 'model_not_found' ||
        message.includes('Rate limit') ||
        message.includes('Failed to validate JSON') ||
        message.includes('decommissioned') ||
        message.includes('not found')

      console.warn(`Groq model failed: ${model}`, message)

      if (!shouldTryNext) {
        throw error
      }
    }
  }

  console.error('All Groq models failed. Using fallback.', lastError?.message)
  throw lastError
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    // Models occasionally wrap JSON in prose/fences — try to recover.
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        /* fall through */
      }
    }
    return fallback
  }
}

/**
 * Heuristic situation detection. Runs with or without AI so resource
 * matching always works. Returns { status, concern, income, urgency }.
 */
export function detectSituation(text = '') {
  const t = text.toLowerCase()
  const situation = { status: 'general', concern: null, income: null, urgency: 'normal' }

  if (/(homeless|nowhere to (go|stay)|on the street|sleeping in|shelter tonight)/.test(t)) {
    situation.status = 'homelessness'
    situation.urgency = 'immediate'
  } else if (/(evict|behind on rent|late (on )?rent|past due rent|landlord|lease|notice to vacate)/.test(t)) {
    situation.status = 'eviction_risk'
    // "tomorrow / today / 24 hours" escalates eviction to immediate.
    situation.urgency = /(tomorrow|today|tonight|24 ?hours|right now|immediately|this week)/.test(t)
      ? 'immediate'
      : 'high'
  } else if (/(lost my job|laid off|unemployed|reduced income|can'?t afford|financial)/.test(t)) {
    situation.status = 'financial_hardship'
  }

  if (/(utilit|power|electric|water bill|gas bill|disconnect|shut ?off|liheap)/.test(t)) {
    situation.concern = 'utilities'
  } else if (/(legal|court|lawyer|attorney|rights|hearing)/.test(t)) {
    situation.concern = 'legal'
  }

  if (/(low income|no income|can'?t afford|struggling|broke)/.test(t)) {
    situation.income = 'low'
  }

  return situation
}

export const groqService = {
  isGroqEnabled,
  detectSituation,

  /**
   * Conversational reply for the chat experience.
   * @param {Array<{role: string, content: string}>} messages
   */
  async chat(messages) {
    if (!groq) return fallbackChatReply(messages)
    const text = await complete({
      messages: [{ role: 'system', content: HOUSING_COUNSELOR_PROMPT }, ...messages],
      maxTokens: 250,
      temperature: 0.6,
    })
    return text || fallbackChatReply(messages)
  },

  /**
   * Conversational turn that ALSO returns structured data for the backend.
   * Only `reply` is ever shown to the user; situation/planAction/planDraft are
   * consumed server-side. The model returns JSON, but the chat bubble shows the
   * `reply` string only — no JSON ever reaches the UI.
   */
  async converse(messages, { hasExistingPlan = false } = {}) {
    if (!groq) return fallbackConverse(messages, hasExistingPlan)

    const system =
      CONVERSE_PROMPT +
      `\n\nContext: the user ${
        hasExistingPlan
          ? 'ALREADY HAS a saved plan — prefer planAction.type "update_draft" when their situation has changed.'
          : 'has NO saved plan yet — use planAction.type "create_draft" when a plan would help.'
      }`

    const text = await complete({
      json: true,
      maxTokens: 700,
      temperature: 0.5,
      messages: [{ role: 'system', content: system }, ...messages],
    })
    const parsed = parseJson(text, null)
    if (!parsed || typeof parsed.reply !== 'string') {
      return fallbackConverse(messages, hasExistingPlan)
    }
    return normalizeConverse(parsed, messages, hasExistingPlan)
  },

  /** Generate a structured, parseable housing plan from a situation. */
  async generatePlan(situation) {
    if (!groq) return fallbackPlan(situation)

    const text = await complete({
      json: true,
      maxTokens: 700,
      temperature: 0.4,
      messages: [
        { role: 'system', content: HOUSING_COUNSELOR_PROMPT },
        {
          role: 'user',
          content: `Create a structured housing plan. Return ONLY valid JSON with this shape:
{
  "goal": "string",
  "riskLevel": "High|Medium|Low",
  "urgency": "Immediate|High|Normal",
  "summary": "string",
  "estimatedTimeline": "string",
  "nextBestAction": "string",
  "tasks": [{ "id": 1, "title": "string", "priority": "High|Medium|Low", "description": "string", "dueDate": "string", "completed": false }],
  "recommendedResources": [1, 3, 5],
  "whyResources": { "1": "string" }
}

Situation: ${JSON.stringify(situation)}`,
        },
      ],
    })
    return parseJson(text, fallbackPlan(situation))
  },

  /** Decide whether an existing plan should change given new info. */
  async updatePlan(userMessage, existingPlan) {
    if (!groq) return fallbackUpdate(userMessage, existingPlan)

    const text = await complete({
      json: true,
      maxTokens: 600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: HOUSING_COUNSELOR_PROMPT },
        {
          role: 'user',
          content: `The user has provided an update. Their existing plan is:

${JSON.stringify(existingPlan)}

New information: "${userMessage}"

If their situation has changed, update the plan. Return JSON:
{ "planAction": "update", "changes": [ { "field": "goal|riskLevel|urgency|summary|nextBestAction|estimatedTimeline", "oldValue": "...", "newValue": "..." }, { "field": "tasksRemove", "value": [1,2] }, { "field": "tasksAdd", "value": [{ "title": "...", "priority": "High", "description": "...", "dueDate": "..." }] } ], "explanation": "..." }

If no changes are needed, return:
{ "planAction": "noChange", "explanation": "Your plan still applies." }`,
        },
      ],
    })
    return parseJson(text, fallbackUpdate(userMessage, existingPlan))
  },

  /** Answer a question about a specific resource. */
  async askAboutResource(resourceName, resourceData, question) {
    if (!groq) return fallbackResourceAnswer(resourceName, resourceData, question)
    const text = await complete({
      maxTokens: 250,
      temperature: 0.4,
      messages: [
        { role: 'system', content: HOUSING_COUNSELOR_PROMPT },
        {
          role: 'user',
          content: `Resource: ${resourceName}\nDetails: ${JSON.stringify(
            resourceData,
          )}\n\nQuestion: ${question}`,
        },
      ],
    })
    return text || fallbackResourceAnswer(resourceName, resourceData, question)
  },
}

/* ------------------------------------------------------------------ */
/* Conversational + structured turn                                    */
/* ------------------------------------------------------------------ */

const CONVERSE_PROMPT = `${HOUSING_COUNSELOR_PROMPT}

You are having a calm, natural conversation with an Atlanta resident. Return ONLY valid JSON with this exact shape:
{
  "reply": "a short, warm, conversational message (3-5 short sentences MAX)",
  "situation": { "status": "eviction_risk|homelessness|financial_hardship|utility_risk|general", "urgency": "immediate|high|normal", "income": "low|moderate|unknown", "housingGoal": "keep_current_housing|find_housing|unknown" },
  "planAction": { "type": "create_draft|update_draft|none", "reason": "short reason" },
  "planDraft": {
    "goal": "string", "riskLevel": "High|Medium|Low", "urgency": "Immediate|High|Normal",
    "summary": "string", "estimatedTimeline": "string", "nextBestAction": "string",
    "tasks": [{ "title": "string", "priority": "High|Medium|Low", "description": "string", "dueDate": "string" }],
    "recommendedResources": [3, 12, 5]
  }
}

Hard rules for "reply":
- 3-5 short sentences, conversational and calm. Never robotic.
- NEVER include JSON, code blocks, markdown, or long bullet lists in "reply".
- No legal advice; suggest contacting Atlanta Legal Aid instead.
- For an eviction happening tomorrow/today, prioritize (in this order): legal aid, emergency shelter backup, rental assistance, calling 211.

Rules for structure:
- "planAction.type" is "none" until the user has shared a real housing need. When "none", set "planDraft" to null.
- Use "create_draft" when a plan would help and the user has no saved plan; "update_draft" when they already have one and their situation changed.
- "planDraft" is for the backend only — never describe it as JSON in "reply".`

function lastUserText(messages) {
  return [...messages].reverse().find((m) => m.role === 'user')?.content || ''
}

function enrichSituation(s) {
  return {
    status: s.status,
    urgency: s.urgency || 'normal',
    income: s.income || 'unknown',
    housingGoal:
      s.status === 'homelessness'
        ? 'find_housing'
        : s.status === 'general'
          ? 'unknown'
          : 'keep_current_housing',
  }
}

function normalizeConverse(parsed, messages, hasExistingPlan) {
  const situation = parsed.situation || enrichSituation(detectSituation(lastUserText(messages)))
  let planAction = parsed.planAction || { type: 'none', reason: '' }
  if (!['create_draft', 'update_draft', 'none'].includes(planAction.type)) {
    planAction = { type: 'none', reason: '' }
  }
  // Keep create/update consistent with whether a plan already exists.
  if (planAction.type === 'create_draft' && hasExistingPlan) planAction.type = 'update_draft'
  if (planAction.type === 'update_draft' && !hasExistingPlan) planAction.type = 'create_draft'

  const planDraft =
    planAction.type === 'none' ? null : parsed.planDraft || fallbackPlan(detectSituation(lastUserText(messages)))
  return { reply: parsed.reply, situation, planAction, planDraft }
}

function fallbackConverse(messages, hasExistingPlan) {
  const s = detectSituation(lastUserText(messages))
  const hasNeed = s.status !== 'general'
  const planAction = hasNeed
    ? {
        type: hasExistingPlan ? 'update_draft' : 'create_draft',
        reason: `User indicates ${s.status.replace('_', ' ')}${
          s.urgency === 'immediate' ? ' (urgent)' : ''
        }.`,
      }
    : { type: 'none', reason: 'Still learning about the situation.' }
  return {
    reply: shortReply(s),
    situation: enrichSituation(s),
    planAction,
    planDraft: hasNeed ? fallbackPlan(s) : null,
  }
}

function shortReply(s) {
  if (s.status === 'eviction_risk' && s.urgency === 'immediate') {
    return "That's urgent — if the eviction is that close, your first moves today are legal aid and an emergency shelter backup, then rental assistance and calling 211. I've pulled a few Atlanta resources that can help right away. I can turn this into a step-by-step plan whenever you're ready. You don't have to handle this alone."
  }
  switch (s.status) {
    case 'eviction_risk':
      return "Thanks for sharing — being behind on rent is stressful, but acting early really does help. Applying for rental assistance and understanding your rights are strong first steps, and I've found some Atlanta resources for you. I can turn this into a step-by-step plan if you'd like."
    case 'homelessness':
      return "I'm really glad you reached out. The most important thing right now is a safe place to stay — I can connect you with emergency shelter and case management here in Atlanta. I can also put together a short plan to help you stabilize. You're not alone in this."
    case 'financial_hardship':
      return "I hear you — a drop in income puts real pressure on housing. Applying for rental and utility assistance early can keep things from snowballing, and I've found some Atlanta programs that fit. I can turn this into a simple plan if that would help."
    default:
      return 'Thanks for telling me what\'s going on. To point you to the right Atlanta resources, could you share a bit more — are you behind on rent, facing a utility shutoff, dealing with your landlord, or needing shelter?'
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic fallbacks — keep the app fully functional with no key */
/* ------------------------------------------------------------------ */

function fallbackChatReply(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
  const s = detectSituation(last)
  const intros = {
    homelessness:
      "I'm really glad you reached out. Needing emergency shelter is frightening, and you don't have to face it alone.",
    eviction_risk:
      "Thank you for sharing this — facing a possible eviction is stressful, and taking action early genuinely helps.",
    financial_hardship:
      "I hear you. A sudden drop in income puts real pressure on housing, and there are Atlanta programs built for exactly this.",
    general:
      "Thanks for telling me what's going on. Let's work through it together and find the right Atlanta resources for you.",
  }
  const next = {
    homelessness:
      'The most immediate step is connecting with emergency shelter and case management today. I can point you to Gateway Center and Families First.',
    eviction_risk:
      'A strong first step is applying for rental assistance right away and understanding your rights. I can recommend rental-assistance and legal-aid resources.',
    financial_hardship:
      'A good first step is applying for rental and utility assistance before bills fall further behind.',
    general:
      'Tell me a bit more — are you behind on rent, facing utility shutoff, dealing with your landlord, or looking for shelter?',
  }
  return `${intros[s.status]} ${next[s.status]}\n\nA few details help me tailor this: your ZIP code, whether you've received any written notices, and roughly how soon you need help. (Note: organizations work to help, but eligibility varies — always confirm details with the provider.)`
}

function fallbackPlan(situation) {
  const status = situation?.status || 'eviction_risk'
  const base = {
    eviction_risk: {
      goal: 'Avoid Eviction & Keep Housing',
      riskLevel: 'High',
      urgency: 'High',
      summary:
        'You are at elevated risk of eviction. Acting quickly on rental assistance and knowing your rights gives you the best chance of staying housed.',
      estimatedTimeline: '30 Days',
      nextBestAction: 'Apply for rental assistance today',
      recommendedResources: [1, 2, 3, 9],
      whyResources: {
        1: 'Direct rental assistance — your primary option for back rent',
        2: 'State-level rental and utility help to broaden your options',
        3: 'Free legal help to protect your rights as a tenant',
        9: 'Short-term assistance as an additional safety net',
      },
      tasks: [
        { id: 1, title: 'Apply for rental assistance', priority: 'High', description: 'Contact Atlanta RAP and submit an application with proof of income and your lease.', dueDate: 'Within 3 days', completed: false },
        { id: 2, title: 'Contact your landlord', priority: 'High', description: 'Communicate your situation and ask about a payment plan in writing.', dueDate: 'Within 5 days', completed: false },
        { id: 3, title: 'Know your rights', priority: 'Medium', description: 'Reach out to Atlanta Legal Aid to understand Georgia eviction protections.', dueDate: 'Within 1 week', completed: false },
        { id: 4, title: 'Gather your documents', priority: 'Medium', description: 'Collect ID, lease, income proof, and any notices in one folder.', dueDate: 'Within 1 week', completed: false },
      ],
    },
    homelessness: {
      goal: 'Secure Safe Shelter & Stabilize',
      riskLevel: 'High',
      urgency: 'Immediate',
      summary:
        'Your immediate priority is safe shelter tonight, followed by case management to work toward stable housing.',
      estimatedTimeline: '2 Weeks',
      nextBestAction: 'Contact emergency shelter intake today',
      recommendedResources: [5, 6, 3],
      whyResources: {
        5: 'Emergency shelter, meals, and case management',
        6: 'Shelter and supportive services for families',
        3: 'Legal help if your housing loss involves a dispute',
      },
      tasks: [
        { id: 1, title: 'Contact emergency shelter', priority: 'High', description: 'Call Gateway Center for intake and a needs assessment.', dueDate: 'Today', completed: false },
        { id: 2, title: 'Meet with a case manager', priority: 'High', description: 'Begin a housing stabilization plan with shelter staff.', dueDate: 'Within 3 days', completed: false },
        { id: 3, title: 'Apply for assistance programs', priority: 'Medium', description: 'Start rental and utility assistance applications for next steps.', dueDate: 'Within 1 week', completed: false },
      ],
    },
    financial_hardship: {
      goal: 'Stabilize Finances & Protect Housing',
      riskLevel: 'Medium',
      urgency: 'Normal',
      summary:
        'A drop in income is manageable with early action on assistance programs and budgeting to keep rent and utilities current.',
      estimatedTimeline: '45 Days',
      nextBestAction: 'Apply for rental and utility assistance',
      recommendedResources: [1, 7, 8, 9],
      whyResources: {
        1: 'Rental assistance to keep rent current',
        7: 'Help with heating bills to prevent disconnection',
        8: 'Water bill assistance for Atlanta residents',
        9: 'Short-term family assistance',
      },
      tasks: [
        { id: 1, title: 'Apply for rental assistance', priority: 'High', description: 'Submit an application before falling further behind.', dueDate: 'Within 1 week', completed: false },
        { id: 2, title: 'Apply for utility assistance', priority: 'Medium', description: 'Contact LIHEAP and the Atlanta utility program.', dueDate: 'Within 1 week', completed: false },
        { id: 3, title: 'Build a basic budget', priority: 'Low', description: 'Prioritize housing and utilities while income recovers.', dueDate: 'Within 2 weeks', completed: false },
      ],
    },
  }
  const plan = base[status] || base.eviction_risk
  return { ...plan }
}

function fallbackUpdate(userMessage, existingPlan) {
  const s = detectSituation(userMessage)
  if (/(found (a )?(job|place|housing|apartment)|new job|got hired|moved in|stable|no longer|resolved|caught up)/i.test(userMessage)) {
    return {
      planAction: 'update',
      changes: [
        { field: 'riskLevel', oldValue: existingPlan?.riskLevel || 'High', newValue: 'Medium' },
        { field: 'urgency', oldValue: existingPlan?.urgency || 'High', newValue: 'Normal' },
        {
          field: 'nextBestAction',
          oldValue: existingPlan?.nextBestAction || '',
          newValue: 'Maintain stability and keep documentation current',
        },
      ],
      explanation:
        'Based on your update, your immediate risk has eased. We lowered the urgency and shifted the focus toward maintaining stability.',
    }
  }
  if (s.status === 'homelessness') {
    return {
      planAction: 'update',
      changes: [
        { field: 'urgency', oldValue: existingPlan?.urgency || 'High', newValue: 'Immediate' },
        {
          field: 'tasksAdd',
          value: [
            { title: 'Contact emergency shelter', priority: 'High', description: 'Call Gateway Center for same-day intake.', dueDate: 'Today' },
          ],
        },
      ],
      explanation:
        'Your situation has become more urgent. We raised the urgency and added an immediate shelter step.',
    }
  }
  return { planAction: 'noChange', explanation: 'Your plan still applies based on what you shared.' }
}

function fallbackResourceAnswer(resourceName, resourceData, question) {
  const elig = Array.isArray(resourceData?.eligibility)
    ? resourceData.eligibility.join('; ')
    : resourceData?.eligibility || 'varies by program'
  return `Here's what I can share about ${resourceName} regarding "${question}":

This program is provided by ${resourceData?.provider || 'the listed provider'}. Typical eligibility: ${elig}. ${
    resourceData?.support ? `Support offered: ${resourceData.support}. ` : ''
  }To confirm whether you qualify and what documents you'll need, contact them directly${
    resourceData?.contact?.phone ? ` at ${resourceData.contact.phone}` : ''
  } or visit their official website. Organizations work to help, but eligibility varies — confirming directly is the best next step.`
}
