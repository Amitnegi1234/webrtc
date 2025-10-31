import jwt from "jsonwebtoken";
import dotenv from "dotenv"
dotenv.config()

const jwtToken=(userId,res)=>{
    try {
        const token=jwt.sign({userId},process.env.JWT_SECRET,{expiresIn:"1d"})
        res.cookie('jwt',token,{
            maxAge:24*60*60*1000,
            httpsOnly:true,
            sameSite:"None",
            secure:true,
            path:"/"
        })
        return token;
    } catch (error) {
        console.log(error);
    }
}
export default jwtToken;