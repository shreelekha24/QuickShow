import express from 'express';
import { getFavorite, getUserBookings, updateFavorite } from '../Controllers/userController.js'; 
import { requireUser } from "../middleware/requireUser.js";

const userRouter=express.Router();


userRouter.get('/bookings',requireUser,getUserBookings);
userRouter.post('/update-favorite',requireUser,updateFavorite);
userRouter.get('/favorites',requireUser,getFavorite);

export default userRouter;
