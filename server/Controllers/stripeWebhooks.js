import Stripe from 'stripe'
import Booking from '../models/Booking.js'
import { inngest } from '../inngest/index.js';

/*export const stripeWebhooks=async(request,response)=>{
    const stripeInstance=new Stripe(process.env.STRIPE_SECRET_KEY)
    const sig=request.headers["stripe-signature"];

    let event;

    try {
        event=stripeInstance.webhooks.constructEvent(request.body,sig,process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`)
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded":{
                const paymentIntent=event.data.object;
                const sessionList=await stripeInstance.checkout.sessions.list({
                    payment_intent:paymentIntent.id
                })
                const session=sessionList.data[0];
                const { bookingId }=session.metadata;
                await Booking.findByIdAndUpdate(bookingId,{
                    isPaid:true,
                    paymentLink:""
                })

                // send confirmation email
                await inngest.send({
                    name: "app/show.booked",
                    data: {bookingId}
                })

                break;
            }
            
            default:
               console.log('Unhandled event type:',event.type);
        }
        response.json({received:true})
    } catch (err) {
        console.error("Webhook processing error:",err);
        response.status(500).send("Internal Server Error")
    }
}*/


export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

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
                const paymentIntent = event.data.object;
                console.log('Payment Intent ID:', paymentIntent.id);

                const sessionList = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntent.id
                });

                console.log('Sessions found:', sessionList.data.length);

                const session = sessionList.data[0];

                if (!session) {
                    console.error('❌ No session found for payment intent');
                    break;
                }

                console.log('Session ID:', session.id);
                console.log('Session metadata:', session.metadata);

                const { bookingId } = session.metadata;
                console.log('Booking ID from metadata:', bookingId);

                if (!bookingId) {
                    console.error('❌ bookingId is missing from session metadata');
                    break;
                }

                const updatedBooking = await Booking.findByIdAndUpdate(
                    bookingId,
                    { isPaid: true, paymentLink: "" },
                    { new: true }
                );

                if (!updatedBooking) {
                    console.error('❌ Booking not found with ID:', bookingId);
                } else {
                    console.log('✅ Booking updated successfully:', updatedBooking.isPaid);
                }

                // send confirmation email
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId }
                });

                break;
            }

            default:
                console.log('Unhandled event type:', event.type);
        }
        
        response.json({ received: true });
        
    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        response.status(500).send("Internal Server Error");
    }
};