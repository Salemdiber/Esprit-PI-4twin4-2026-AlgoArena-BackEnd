import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

type CheckoutSessionLike = {
  id: string;
  metadata?: Record<string, string | undefined> | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string;
};

const normalizeFrontendUrl = (value?: string | null) =>
  (value || 'http://localhost:5173').replace(/\/+$/, '');

@Injectable()
export class BillingService {
  private readonly stripe: Stripe.Stripe | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly users: UserService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  createHintCheckoutSession = async (userId: string, amount = 1) => {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');

    const user = (await this.users.findOne(userId).catch(() => null)) as any;
    if (!user) throw new NotFoundException('User not found');

    const credits = Math.max(1, Number(amount) || 1);
    const unitAmount = 199;
    const totalAmount = unitAmount * credits;

    const frontendUrl = normalizeFrontendUrl(
      this.configService.get<string>('FRONTEND_URL'),
    );
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${frontendUrl}/profile/billing?hint_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/profile/billing?hint_purchase=cancel`,
      line_items: [
        {
          quantity: credits,
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: 'AlgoArena Hint Credits',
              description: `Unlock ${credits} additional hint credit${credits > 1 ? 's' : ''}`,
            },
          },
        },
      ],
      metadata: {
        userId,
        credits: String(credits),
        unitAmount: String(unitAmount),
        totalAmount: String(totalAmount),
      },
    });

    return { url: session.url, unitAmount, totalAmount, credits };
  };

  confirmStripeSession = async (sessionId: string) => {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const safeSessionId = String(sessionId || '').trim();
    if (!safeSessionId) throw new BadRequestException('Session id is required');

    const session = await this.stripe.checkout.sessions.retrieve(safeSessionId);
    if (session.payment_status !== 'paid') {
      return {
        fulfilled: false,
        paymentStatus: session.payment_status ?? 'unpaid',
      };
    }

    const userId = String(session.metadata?.userId || '');
    if (!userId) {
      throw new BadRequestException('Missing session user');
    }

    const credits = Number(session.metadata?.credits || 1);
    const result = await this.users.addHintCredits(userId, credits, {
      stripeSessionId: session.id,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
    });

    return {
      fulfilled: true,
      paymentStatus: session.payment_status,
      hintCredits: result.hintCredits,
    };
  };

  fulfillStripeSession = async (session: CheckoutSessionLike) => {
    const userId = String(session.metadata?.userId || '');
    if (!userId) return;
    const credits = Number(session.metadata?.credits || 1);
    await this.users.addHintCredits(userId, credits, {
      stripeSessionId: session.id,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
    });
  };
}
