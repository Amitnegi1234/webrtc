import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config() 
const url=process.env.MONGO_URI

export const connectDB=async()=>{
    try {
        await mongoose.connect(url)
        console.log("connection created");
    } catch (error) {
        console.log(error);
    }
}