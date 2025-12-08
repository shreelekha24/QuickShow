import Stripe from 'stripe';
import Booking from '../models/Booking.js';
// import { inngest } from '../inngest/index.js';

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhooks = async (request, response) => {
  const sig = request.headers['stripe-signature'];

  console.log('📍 Webhook received on /api/stripe');

  let event;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim(); // ✅ remove accidental spaces

  try {
    // IMPORTANT: request.body must be raw Buffer from express.raw({ type: 'application/json' })
    event = stripeInstance.webhooks.constructEvent(
      request.body,
      sig,
      webhookSecret
    );

    console.log('✅ Webhook verified successfully');
    console.log('Event type:', event.type);
  } catch (error) {
    console.error('❌ Webhook verification failed:', error.message);
    return response.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      // ✅ MAIN: handle checkout.session.completed and update booking
      case 'checkout.session.completed': {
        console.log('✅ Checkout session completed');

        const session = event.data.object;
        console.log('Session ID:', session.id);
        console.log('Session payment_status:', session.payment_status);
        console.log('Session metadata:', session.metadata);

        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.error('❌ bookingId missing in session metadata – cannot update booking');
          // Do NOT return 400 here; just log and move on so Stripe doesn't keep retrying
          break;
        }

        if (session.payment_status !== 'paid') {
          console.log('ℹ️ Session is not paid yet, skipping booking update');
          break;
        }

        console.log('Attempting to update booking:', bookingId);

        const updatedBooking = await Booking.findByIdAndUpdate(
          bookingId,
          {
            isPaid: true,
            paymentLink: '', // clear payment link since it's paid
          },
          { new: true }
        );

        if (!updatedBooking) {
          console.error('❌ Booking not found with ID:', bookingId);
          // Still break without error so Stripe stops retrying
          break;
        }

        console.log('✅ Booking updated successfully!');
        console.log('Updated isPaid:', updatedBooking.isPaid);

        
        // Optional: send confirmation email / trigger job
        await inngest.send({
          name: 'app/show.booked',
          data: { bookingId },
        });
        console.log('✅ Inngest event sent');

        break;
      }

      // ℹ️ We keep this event but don't use it for booking updates (to avoid double-updating)
      case 'payment_intent.succeeded': {
        console.log('ℹ️ payment_intent.succeeded received (not used for booking updates)');
        const paymentIntent = event.data.object;
        console.log('Payment Intent ID:', paymentIntent.id);
        console.log('Payment Intent Metadata:', paymentIntent.metadata);
        break;
      }

      default: {
        console.log('ℹ️ Unhandled event type:', event.type);
        break;
      }
    }

    // Always acknowledge receipt so Stripe doesn't retry
    return response.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
};
