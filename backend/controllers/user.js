import User from "../models/user.js";

export const getAllUsers=async(req,res)=>{
    // const currentUserId=req.user?._conditions?._id;
    const currentUserId=req.user?._id;
    if(!currentUserId){
        return res.status(500).send({success:false,message:"unauthorised user"})
    }
    try {
        const users=await User.find({_id:{$ne:currentUserId}},"profile email username")
        res.status(200).send({success:true,users})
    } catch (error) {
        console.log(error);
    }
}