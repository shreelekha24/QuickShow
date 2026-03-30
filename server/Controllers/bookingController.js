import Show from "../models/Show.js"
import Booking from "../models/Booking.js"
import Stripe from "stripe"
import { inngest } from "../inngest/index.js"

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
})

const extractCheckoutSessionId = (paymentLink = "") => {
    const match = paymentLink.match(/\/pay\/(cs_[^?#/]+)/);
    return match ? match[1] : "";
}

// Function to check availability of selected seats for a movie
const checkSeatAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId).lean()
        if (!showData) return false;
        
        const occupiedSeats = showData.occupiedSeats || {};
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
        const origin = req.headers.origin || process.env.CLIENT_URL;

        if (!showId || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Show and seats are required.",
            });
        }

        console.log('Creating booking for user:', userId);
        console.log('Show ID:', showId);
        console.log('Selected Seats:', selectedSeats);

        const isAvailable = await checkSeatAvailability(showId, selectedSeats);
        
        if (!isAvailable) {
            console.warn('❌ Selected seats not available');
            return res.status(409).json({ success: false, message: "Selected seats are not available." });
        }

        // Get the show details
        const showData = await Show.findById(showId).populate("movie");
        
        if (!showData) {
            return res.status(404).json({ success: false, message: "Show not found." });
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
            success_url: `${origin}/my-bookings?success=true&bookingId=${booking._id.toString()}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/my-bookings?canceled=true`,
            line_items: line_items,
            mode: 'payment',
            
            
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
        booking.checkoutSessionId = session.id;
        await booking.save();

        // Run Inngest scheduler to check payment status after 10 minutes
        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString()
            }
        });

        console.log('✅ Inngest payment check scheduled');

        return res.json({ 
            success: true, 
            url: session.url,
            bookingId: booking._id.toString()
        });

    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const verifyBookingPayment = async (req, res) => {
    try {
        const requestedBookingId = req.body.bookingId;
        const userId = req.userId;

        let booking;

        if (requestedBookingId) {
            booking = await Booking.findOne({ _id: requestedBookingId, user: userId });
        } else {
            booking = await Booking.findOne({
                user: userId,
                isPaid: false,
            }).sort({ createdAt: -1 });
        }

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found.",
            });
        }

        if (booking.isPaid) {
            return res.json({
                success: true,
                isPaid: true,
                message: "Booking is already marked as paid.",
            });
        }

        const sessionId = booking.checkoutSessionId || extractCheckoutSessionId(booking.paymentLink);

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Checkout session not found for this booking.",
            });
        }

        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
            return res.json({
                success: true,
                isPaid: false,
                message: "Payment is not completed yet.",
            });
        }

        booking.isPaid = true;
        booking.paymentLink = "";
        booking.checkoutSessionId = session.id;
        await booking.save();

        await inngest.send({
            name: "app/show.booked",
            data: { bookingId: booking._id.toString() },
        });

        return res.json({
            success: true,
            isPaid: true,
            message: "Payment verified successfully.",
        });
    } catch (error) {
        console.error("Error verifying booking payment:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        
        if (!showData) {
            return res.status(404).json({ success: false, message: "Show not found." });
        }
        
        const occupiedSeats = Object.keys(showData.occupiedSeats || {});
        return res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}
