// Calculates dynamic match scores between a user's situation and resources.
// Scores are generated here — never hardcoded in the data (Adjustment 1).
// Later this seam can be replaced with vector similarity search.
export const matchingService = {
  // Generate a match score + reason for every resource relative to a situation.
  scoreResources: (situation = {}, resources = []) => {
    return resources.map((resource) => ({
      resourceId: resource.id,
      score: scoreOne(situation, resource),
      reason: matchingService.getMatchReason(situation, resource),
    }))
  },

  // Top N recommended resources (highest score first).
  getRecommendedResources: (situation = {}, resources = [], topN = 5) => {
    return matchingService
      .scoreResources(situation, resources)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
  },

  // Human-readable explanation of why a resource matches.
  getMatchReason: (situation = {}, resource = {}) => {
    const urgentEviction =
      situation.status === 'eviction_risk' &&
      (situation.urgency === 'immediate' || situation.urgency === 'high')
    if (urgentEviction && resource.category === 'Legal Aid') {
      return 'Urgent: legal help can act fast to stop or delay an eviction'
    }
    if (urgentEviction && resource.category === 'Shelter & Housing') {
      return 'Emergency shelter backup in case you need somewhere safe quickly'
    }
    if (urgentEviction && /\b211\b/.test(resource.name || '')) {
      return 'Call 211 to be routed to immediate local help'
    }
    if (situation.concern === 'mortgage') {
      if (/foreclos|mortgage|homesafe|homeowner/i.test(`${resource.name} ${resource.description || ''}`)) {
        return 'Helps homeowners with mortgage or foreclosure hardship'
      }
      if (resource.category === 'Legal Aid') return 'Legal help for foreclosure and mortgage disputes'
      if (/\b211\b/.test(resource.name || '')) return 'Call 211 to be routed to mortgage/foreclosure help'
    }
    if (situation.status === 'eviction_risk' && resource.category === 'Rent & Financial Help') {
      return 'Direct rental assistance for eviction prevention'
    }
    if (situation.status === 'homelessness' && resource.category === 'Shelter & Housing') {
      return 'Emergency shelter and case management'
    }
    if (situation.concern === 'utilities' && resource.category === 'Utilities') {
      return 'Help preventing utility disconnection'
    }
    if (situation.concern === 'legal' && resource.category === 'Legal Aid') {
      return 'Free legal help to protect your housing rights'
    }
    if (situation.status === 'financial_hardship' && resource.category === 'Rent & Financial Help') {
      return 'Financial assistance to keep rent current'
    }
    return 'Relevant housing support service'
  },
}

function scoreOne(situation, resource) {
  let score = 50 // base score
  const urgent = situation.urgency === 'immediate' || situation.urgency === 'high'

  if (situation.status === 'eviction_risk') {
    if (urgent) {
      // Urgent eviction needs legal/emergency support FIRST, not only rental.
      if (resource.category === 'Legal Aid') score += 42
      if (resource.category === 'Shelter & Housing') score += 30 // emergency backup
      if (resource.category === 'Rent & Financial Help') score += 25
      if (/\b211\b/.test(resource.name || '')) score += 15 // surface United Way 211
    } else {
      // Non-urgent: rental assistance leads, legal rights second.
      if (resource.category === 'Rent & Financial Help') score += 35
      if (resource.category === 'Legal Aid') score += 15
    }
  }

  // Homelessness → shelter
  if (situation.status === 'homelessness' && resource.category === 'Shelter & Housing') {
    score += 40
  }

  // Financial hardship → financial help
  if (situation.status === 'financial_hardship' && resource.category === 'Rent & Financial Help') {
    score += 25
  }

  // Utility shutoff concern → utility assistance
  if (situation.concern === 'utilities' && resource.category === 'Utilities') {
    score += 30
  }

  // Legal concern → legal aid
  if (situation.concern === 'legal' && resource.category === 'Legal Aid') {
    score += 30
  }

  // Mortgage / homeownership concern → legal aid + 211, and strongly favor
  // foreclosure/mortgage-focused programs (e.g. Foreclosure Prevention, HomeSafe).
  if (situation.concern === 'mortgage') {
    if (resource.category === 'Legal Aid') score += 30
    if (/\b211\b/.test(resource.name || '')) score += 25
    if (/foreclos|mortgage|homesafe|homeowner/i.test(`${resource.name} ${resource.description || ''}`)) {
      score += 40
    }
  }

  // Income level matches stated eligibility
  if (
    situation.income === 'low' &&
    typeof resource.eligibility === 'string' &&
    /low/i.test(resource.eligibility)
  ) {
    score += 10
  }

  return Math.min(score, 99)
}
