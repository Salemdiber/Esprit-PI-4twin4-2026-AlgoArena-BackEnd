import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Stripe checkout session for hint credits',
  })
  @ApiResponse({ status: 200, description: 'Checkout URL created' })
  @Post('hint-credits/checkout')
  createHintCreditsCheckout(@Req() req: any, @Body() body: any) {
    const amount = Number(body?.amount || 1);
    return this.billingService.createHintCheckoutSession(
      String(req.user?.userId || req.user?.sub || req.user?.id),
      amount,
    );
  }

  @Post('stripe/webhook')
  async stripeWebhook(@Body() body: any) {
    if (body?.type === 'checkout.session.completed' && body?.data?.object) {
      await this.billingService.fulfillStripeSession(body.data.object);
    }
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm a Stripe checkout session and apply hint credits',
  })
  @ApiResponse({ status: 200, description: 'Checkout session confirmed' })
  @Post('stripe/confirm')
  confirmStripeSession(@Body() body: any) {
    return this.billingService.confirmStripeSession(
      String(body?.sessionId || ''),
    );
  }
}
