import { Inngest } from "inngest";
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Show from '../models/Show.js';
import sendEmail from "../configs/nodeMailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to database
export const syncUserCreation = inngest.createFunction(
  { id: 'sync-user-from-clerk' },
  { event: 'clerk/user.created' },
  async ({ event }) => {
    try {
      const { id, first_name, last_name, email_addresses, image_url } = event.data;
      const userData = {
        _id: id,
        email: email_addresses[0].email_address,
        name: first_name + ' ' + last_name,
        image: image_url
      };
      await User.create(userData);
      console.log("User created successfully:", id);
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
);

// Inngest function to delete user data from database
export const syncUserDeletion = inngest.createFunction(
  { id: 'delete-user-with-clerk' },
  { event: 'clerk/user.deleted' },
  async ({ event }) => {
    try {
      const { id } = event.data;
      await User.findByIdAndDelete(id);
      console.log("User deleted successfully:", id);
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }
);

// Inngest function to update user data in database
export const syncUserUpdation = inngest.createFunction(
  { id: 'update-user-from-clerk' },
  { event: 'clerk/user.updated' },
  async ({ event }) => {
    try {
      const { id, first_name, last_name, email_addresses, image_url } = event.data;
      const userData = {
        _id: id,
        email: email_addresses[0].email_address,
        name: first_name + ' ' + last_name,
        image: image_url
      };
      await User.findByIdAndUpdate(id, userData, { upsert: true });
      console.log("User updated successfully:", id);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }
);

// Inngest Function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
export const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: "release-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    try {
      const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
      await step.sleepUntil("wait-for-10-minutes", tenMinutesLater);
      
      await step.run("check-payment-status", async () => {
        const bookingId = event.data.bookingId;
        const booking = await Booking.findById(bookingId);
        
        if (!booking) {
          console.log("Booking not found:", bookingId);
          return;
        }

        // if payment not made release seats and delete booking
        if (!booking.isPaid) {
          const show = await Show.findById(booking.show);
          if (show && booking.bookedSeats) {
            booking.bookedSeats.forEach((seat) => {
              delete show.occupiedSeats[seat];
            });
            show.markModified("occupiedSeats");
            await show.save();
          }
          await Booking.findByIdAndDelete(booking._id);
          console.log("Booking canceled and seats released:", bookingId);
        }
      });
    } catch (error) {
      console.error("Error in releaseSeatsAndDeleteBooking:", error);
      throw error;
    }
  }
);

// Inngest function to send email when user books a show
export const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event, step }) => {
    try {
      const { bookingId } = event.data;
      const booking = await Booking.findById(bookingId).populate({
        path: "show",
        populate: { path: "movie", model: "Movie" }
      }).populate('user');

      if (!booking) {
        console.error("Booking not found:", bookingId);
        return;
      }

      const movieTitle = booking.show.movie.title;
      const showDate = new Date(booking.show.showDateTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      const showTime = new Date(booking.show.showDateTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });

      await sendEmail({
        to: booking.user.email,
        subject: `Payment Confirmation: "${movieTitle}" booked!`,
        body: `
Dear ${booking.user.name},

Your booking for **${movieTitle}** is confirmed!

**Date:** ${showDate}

**Time:** ${showTime}

**Booked Seats:** ${booking.bookedSeats.join(', ')}

**Total Price:** ₹${booking.totalPrice}

Enjoy the show! 🍿

Thanks for booking with us!

— QuickShow Team 🎬

---

This is your booking confirmation. Please arrive 15 minutes before the show starts.
`
      });

      console.log("Booking confirmation email sent to:", booking.user.email);
    } catch (error) {
      console.error("Error sending booking confirmation email:", error);
      throw error;
    }
  }
);
