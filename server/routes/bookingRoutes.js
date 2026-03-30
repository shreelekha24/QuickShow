import express from 'express';
import { createBooking, getOccupiedSeats, verifyBookingPayment } from '../Controllers/bookingController.js';
import { requireUser } from "../middleware/requireUser.js";

const bookingRouter = express.Router();

bookingRouter.post('/create',requireUser, createBooking);
bookingRouter.post('/verify-payment',requireUser, verifyBookingPayment);
bookingRouter.get('/seats/:showId', getOccupiedSeats);

export default bookingRouter;
