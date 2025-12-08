import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import { inngest } from '../inngest/index.js';

export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

    console.log('📍 Webhook received on /api/stripe');

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log('✅ Webhook verified successfully');
        console.log('Event type:', event.type);
    } catch (error) {
        console.error('❌ Webhook verification failed:', error.message);
        return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded": {
                console.log('💰 Processing payment_intent.succeeded');
                
                const paymentIntent = event.data.object;
                console.log('Payment Intent ID:', paymentIntent.id);
                console.log('Payment Intent Metadata:', paymentIntent.metadata);

                // Get booking ID from PaymentIntent metadata
                const bookingId = paymentIntent.metadata?.bookingId;
                
                console.log('Extracted Booking ID:', bookingId);

                if (!bookingId) {
                    console.error('❌ bookingId is missing from PaymentIntent metadata');
                    return response.status(400).json({ error: 'Missing bookingId in metadata' });
                }

                // Update booking in database
                console.log('Attempting to update booking:', bookingId);
                
                const updatedBooking = await Booking.findByIdAndUpdate(
                    bookingId,
                    { 
                        isPaid: true, 
                        paymentLink: "" 
                    },
                    { new: true }
                );

                if (!updatedBooking) {
                    console.error('❌ Booking not found with ID:', bookingId);
                    return response.status(404).json({ error: 'Booking not found' });
                }

                console.log('✅ Booking updated successfully!');
                console.log('Updated isPaid:', updatedBooking.isPaid);

                // Send confirmation email via Inngest
               await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId: bookingId }
                });

                console.log('✅ Inngest event sent');
                break;
            }

            case "checkout.session.completed": {
                console.log('✅ Checkout session completed');
                
                const session = event.data.object;
                console.log('Session metadata:', session.metadata);
                
                const bookingId = session.metadata?.bookingId;

                if (session.payment_status === 'paid' && bookingId) {
                    const updatedBooking = await Booking.findByIdAndUpdate(
                        bookingId,
                        { 
                            isPaid: true, 
                            paymentLink: "" 
                        },
                        { new: true }
                    );

                    console.log('✅ Booking marked as paid:', updatedBooking?.isPaid);

                   /* await inngest.send({
                        name: "app/show.booked",
                        data: { bookingId }
                    });*/
                }
                break;
            }

            default:
                console.log('ℹ️ Other event type:', event.type);
        }
        
        response.json({ received: true });
        
    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        response.status(500).json({ error: 'Internal Server Error' });
    }
};