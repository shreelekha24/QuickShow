import express from 'express';
import { createBooking, getOccupiedSeats } from '../Controllers/bookingController.js';
import { requireUser } from "../middleware/requireUser.js";

const bookingRouter = express.Router();

bookingRouter.post('/create',requireUser, createBooking);
bookingRouter.get('/seats/:showId',requireUser, getOccupiedSeats);

export default bookingRouter;