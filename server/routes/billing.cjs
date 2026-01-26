const express = require('express');
const { getStripe } = require('../services/stripe.cjs');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');
const {
  getBillingCustomerByOrg,
  getBillingCustomerByStripeId,
  upsertBillingCustomer,
  getSubscriptionByOrg,
  getSubscriptionByStripeId,
  upsertSubscription,
  recordInvoice,
  updateOrgPlan
} = require('../db/sqliteStore.cjs');

const router = express.Router();

const PRICE_MAP = {
  pro: {
    month: process.env.STRIPE_PRICE_PRO_MONTHLY,
    year: process.env.STRIPE_PRICE_PRO_YEARLY
  },
  team: {
    month: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    year: process.env.STRIPE_PRICE_TEAM_YEARLY
  }
};

function getPriceId(planId, interval) {
  const map = PRICE_MAP[planId];
  if (!map) return null;
  return map[interval] || null;
}

router.get('/billing/status', requireAuth, requireTenant, (req, res) => {
  const orgId = req.auth?.tenant?.orgId;
  const subscription = getSubscriptionByOrg(orgId);
  res.json({
    success: true,
    data: {
      subscription: subscription || null
    }
  });
});

router.post('/billing/checkout', requireAuth, requireTenant, requirePermission('admin:policies/manage'), async (req, res) => {
  const { planId = 'pro', interval = 'month' } = req.body || {};
  const priceId = getPriceId(planId, interval);
  if (!priceId) {
    return res.status(400).json({ success: false, error: 'Invalid plan or interval.' });
  }
  const orgId = req.auth?.tenant?.orgId;
  const userId = req.user?.id;
  const stripe = getStripe();

  let billingCustomer = getBillingCustomerByOrg(orgId);
  if (!billingCustomer) {
    const customer = await stripe.customers.create({
      email: req.user?.email || undefined,
      name: req.user?.name || undefined,
      metadata: { org_id: orgId, user_id: userId }
    });
    billingCustomer = upsertBillingCustomer({
      orgId,
      userId,
      stripeCustomerId: customer.id
    });
  }

  const successUrl = process.env.STRIPE_SUCCESS_URL || `${req.headers.origin || ''}/billing?status=success`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || `${req.headers.origin || ''}/billing?status=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: billingCustomer.stripe_customer_id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { org_id: orgId, user_id: userId, plan_id: planId },
    subscription_data: {
      metadata: { org_id: orgId, user_id: userId, plan_id: planId }
    }
  });

  res.json({ success: true, data: { url: session.url } });
});

router.post('/billing/portal', requireAuth, requireTenant, requirePermission('admin:policies/manage'), async (req, res) => {
  const orgId = req.auth?.tenant?.orgId;
  const billingCustomer = getBillingCustomerByOrg(orgId);
  if (!billingCustomer) {
    return res.status(400).json({ success: false, error: 'No billing customer found.' });
  }
  const stripe = getStripe();
  const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || `${req.headers.origin || ''}/billing`;
  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer.stripe_customer_id,
    return_url: returnUrl
  });
  res.json({ success: true, data: { url: session.url } });
});

async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.org_id || null;
        const userId = session.metadata?.user_id || null;
        const planId = session.metadata?.plan_id || 'pro';
        if (orgId && userId) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          upsertSubscription({
            org_id: orgId,
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscription.id,
            plan_id: planId,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end ? 1 : 0,
            price_id: subscription.items.data[0]?.price?.id || null,
            interval: subscription.items.data[0]?.price?.recurring?.interval || null
          });
          updateOrgPlan(orgId, planId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const orgId = subscription.metadata?.org_id || null;
        const userId = subscription.metadata?.user_id || null;
        const planId = subscription.metadata?.plan_id || 'free';
        if (orgId && userId) {
          upsertSubscription({
            org_id: orgId,
            user_id: userId,
            stripe_customer_id: subscription.customer,
            stripe_subscription_id: subscription.id,
            plan_id: planId,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end ? 1 : 0,
            price_id: subscription.items.data[0]?.price?.id || null,
            interval: subscription.items.data[0]?.price?.recurring?.interval || null
          });
          const nextPlan = subscription.status === 'active' ? planId : 'free';
          updateOrgPlan(orgId, nextPlan);
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        let orgId = invoice.metadata?.org_id || null;
        let userId = invoice.metadata?.user_id || null;
        if (!orgId && invoice.subscription) {
          const sub = getSubscriptionByStripeId(invoice.subscription);
          orgId = sub?.org_id || null;
          userId = sub?.user_id || null;
        }
        if (!orgId && invoice.customer) {
          const cust = getBillingCustomerByStripeId(invoice.customer);
          orgId = cust?.org_id || null;
          userId = cust?.user_id || null;
        }
        recordInvoice({
          org_id: orgId,
          user_id: userId,
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: invoice.subscription,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          paid: invoice.paid
        });
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  router,
  handleStripeWebhook
};
