import Show from "../models/Show.js"
import Booking from "../models/Booking.js"
import Stripe from 'stripe'
import { inngest } from "../inngest/index.js"

// Function to check availability of selected seats for a movie
const checkSeatAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId).lean()
        if (!showData) return false;
        
        const occupiedSeats = showData.occupiedSeats;
        const isAnySeatTaken = selectedSeats.some((seat) =>
      Object.prototype.hasOwnProperty.call(occupiedSeats, seat)
    );
        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
        return false;
    }
}

export const createBooking = async (req, res) => {
    try {
        const mongoUser = req.user;          // the MongoDB user doc
        const userId = mongoUser._id;  
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        console.log('Creating booking for user:', userId);
        console.log('Show ID:', showId);
        console.log('Selected Seats:', selectedSeats);

        const isAvailable = await checkSeatAvailability(showId, selectedSeats);
        
        if (!isAvailable) {
            console.warn('❌ Selected seats not available');
            return res.json({ success: false, message: "Selected Seats are not available." });
        }

        // Get the show details
        const showData = await Show.findById(showId).populate("movie");
        
        if (!showData) {
            return res.json({ success: false, message: "Show not found" });
        }

        // Create a new booking
        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: showData.showPrice * selectedSeats.length,
            bookedSeats: selectedSeats,
            isPaid: false
        });

        console.log('✅ Booking created:', booking._id);

        // Mark seats as occupied
        // Mark seats as occupied
        selectedSeats.forEach((seat) => {
       showData.occupiedSeats[seat] = userId;
      });

       showData.markModified('occupiedSeats');
       await showData.save();

      console.log('Updated occupiedSeats:', showData.occupiedSeats);

        // Initialize Stripe
        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)

        // Create line items for Stripe
        const line_items = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: showData.movie.title,
                    description: `${selectedSeats.length} seat(s) for ${showData.movie.title}`
                },
                unit_amount: Math.round(showData.showPrice * 100)
            },
            quantity: selectedSeats.length
        }]

        console.log('Creating Stripe checkout session...');

        // ✅ CRITICAL: Create checkout session WITH payment_intent_data metadata
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items,
            mode: 'payment',
            
            success_url: `${origin}/loading/my-bookings?status=success`,
            cancel_url: `${origin}/my-bookings?status=cancel`,
            
            // ✅ Metadata for the checkout session
            metadata: {
                bookingId: booking._id.toString()
            },
            
            // ✅ CRITICAL: Metadata for the PaymentIntent (required for webhook)
            payment_intent_data: {
                metadata: {
                    bookingId: booking._id.toString()
                }
            },
            
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        });

        console.log('✅ Stripe session created:', session.id);
        console.log('Checkout URL:', session.url);

        // Save payment link to booking
        booking.paymentLink = session.url;
        await booking.save();

        console.log('✅ Booking updated with payment link');

        // Run Inngest scheduler to check payment status after 10 minutes
        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString()
            }
        });

        console.log('✅ Inngest payment check scheduled');

        res.json({ 
            success: true, 
            url: session.url,
            bookingId: booking._id.toString()
        });

    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        
        if (!showData) {
            return res.json({ success: false, message: "Show not found" });
        }
        
        const occupiedSeats = Object.keys(showData.occupiedSeats);
        res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}