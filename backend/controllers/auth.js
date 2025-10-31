import User from "../models/user.js"
import bcrypt from "bcryptjs"
import jwtToken from "../utils/jwtToken.js";
export const signup=async(req,res)=>{
    try {
        const {fullname,username,email,password,gender,profilepic}=req.body;
        const user=await User.findOne({username});
        if(user){
            return res.status(500).json({
                success:false,
                message:"username already exits"
            })
        }
        const emailExists=await User.findOne({email});
        if(emailExists){
            return res.status(500).json({
                success:false,
                message:"email already exits"
            })
        }
        const hashPassword=await bcrypt.hash(password,10);
        const boyppf=profilepic || `https://avatar.iran.liara.run/public/boy?username=${username}`
        const girlppf=profilepic || `https://avatar.iran.liara.run/public/girl?username=${username}`

        const newUser=new User({
            fullname,username,email,password:hashPassword,gender,
            profilepic:gender==='male'?boyppf:girlppf
        })
        if(newUser){
            await newUser.save()
        }
        res.status(201).send({
            message:"signup successfull"
        })
    } catch (error) {
        console.log(error);
    }
}

export const login=async(req,res)=>{
    try {
        const {email,password}=req.body;
        const user=await User.findOne({email})
        if(!user){
            return res.status(500).json({
                success:false,
                message:"email not exists"
            })
        }
        const comparePassword=bcrypt.compareSync(password,user.password)
        if(!comparePassword){
            return res.status(500).json({
                success:false,
                message:"password incorrect"
            })
        }
        const token=jwtToken(user._id,res)
        res.status(201).json({
            success:true,
            message:"login successfull",
            token,
            _id:user._id,
            fullname:user.fullname,
            username:user.username,
            profilepic:user.profilepic,
            email:user.email,
        })
        
    } catch (error) {
        console.log(error);
    }
}

export const logout=async(req,res)=>{
    try {
        res.clearCookie('jwt',{
            path:"/",
            httpOnly:true,
            secure:true
        })
        return res.status(200).json({
            success: true,
            message: "Logout successful",
        });
    } catch (error) {
        console.log(error);
    }
}