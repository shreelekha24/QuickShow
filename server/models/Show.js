import mongoose from "mongoose";

const showSchema = new mongoose.Schema(
  {
    movie: { type: String, required: true, ref: 'Movie' },
    showDateTime: { type: Date, required: true },
    showPrice: { type: Number, required: true },
    occupiedSeats: { type: Object, default: {} },
    isActive: { type: Boolean, default: true } // ✅ ADD THIS
  },
  { minimize: false, timestamps: true }
);


const Show=mongoose.model('Show',showSchema)

export default Show;