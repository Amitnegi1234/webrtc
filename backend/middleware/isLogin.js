import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.js";
dotenv.config();

export const isLogin=async(req,res,next)=>{
    try {
        const token=req.cookies.jwt || req.headers.cookie.split(";").find((cookie)=>cookie.startsWith("jwt="))?.split("=")[1]
        if(!token){
            return res.status(500).send({
                success:false,
                message:"user unauthorized"
            })
        }
        const decode=jwt.verify(token,process.env.JWT_SECRET);
        if(!decode){
            return res.status(500).send({
                success:false,
                message:"user unauthorized"
            })
        }
        const user=await User.findById(decode.userId).select("-password")
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid token or user not found" });
        }
        req.user=user;
        next()
    } catch (error) {
        console.log(error);
    }
}