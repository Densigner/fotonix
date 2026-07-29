// Shared by AffiliateDashboard.js (first line of defence — the "Mail
// Campaign" button on the dashboard itself) and AutomationsEditor.js (the
// composer's own Send Campaign buttons) so the threshold/window/messaging
// can't drift out of sync between the two gate points.

// Affiliates need this many real sales, in this many trailing days, to send
// campaigns — and have to keep clearing the bar every month to retain
// access. A single rolling window handles both "N to unlock" and "N/month
// to keep it" without separate lifetime + calendar-month bookkeeping.
export const CAMPAIGN_SALES_REQUIRED = 3;
export const CAMPAIGN_SALES_WINDOW_DAYS = 30;
export const CAMPAIGN_GATE_ADMIN_EMAIL = 'joshmarsden28@gmail.com';
export const CAMPAIGN_GATE_CONTACT_EMAIL = 'josh@fotonix.co.uk';

// attributions: array of { date, status, ... } as returned by
// GET /api/affiliates/attributions?code=... — 'void' sales don't count.
export function computeCampaignSalesGate(attributions) {
  const list = Array.isArray(attributions) ? attributions : [];
  const cutoff = Date.now() - CAMPAIGN_SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentSales = list.filter(a => a.status !== 'void' && new Date(a.date).getTime() >= cutoff).length;
  return { unlocked: recentSales >= CAMPAIGN_SALES_REQUIRED, recentSales };
}

export function campaignGateAlertMessage(recentSales) {
  return `Campaign sending is locked.\n\n` +
    `You need at least ${CAMPAIGN_SALES_REQUIRED} sales in the last ${CAMPAIGN_SALES_WINDOW_DAYS} days to send email campaigns ` +
    `(you currently have ${recentSales}). Once unlocked, you'll need to keep making at least ` +
    `${CAMPAIGN_SALES_REQUIRED} sales every month to hold onto it.\n\n` +
    `Keep sharing your affiliate link to get there. If you think this is wrong, email ${CAMPAIGN_GATE_CONTACT_EMAIL}.`;
}
