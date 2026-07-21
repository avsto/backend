import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
{
    gameDuration:{
        type:Number,
        default:30
    },

    breakTime:{
        type:Number,
        default:1
    },

    bettingEnabled:{
        type:Boolean,
        default:true
    },

    maintenanceMode:{
        type:Boolean,
        default:false
    },

    minimumBet:{
        type:Number,
        default:10
    },

    maximumBet:{
        type:Number,
        default:10000
    },

    numberMultiplier:{
        type:Number,
        default:9
    },

    colorMultiplier:{
        type:Number,
        default:2
    },

    sizeMultiplier:{
        type:Number,
        default:2
    },

    minimumDeposit:{
        type:Number,
        default:100
    },

    minimumWithdraw:{
        type:Number,
        default:200
    },

    withdrawCharge:{
        type:Number,
        default:0
    },

    signupBonus:{
        type:Number,
        default:0
    },

    referralBonus:{
        type:Number,
        default:50
    },

    resultMode:{
        type:String,
        enum:["auto","manual","rtp"],
        default:"auto"
    },

    manualNumber:Number,

    manualColor:String,

    manualSize:String,

    rtpEnabled:{
        type:Boolean,
        default:false
    },

    rtpPercentage:{
        type:Number,
        default:80
    }
},
{
    timestamps:true
});

export default mongoose.model("Setting",settingSchema);