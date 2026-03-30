import axios from "axios";
import Movie from '../models/Movie.js'
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

const tmdbClient = axios.create({
    baseURL: "https://api.themoviedb.org/3",
    proxy: false,
    timeout: 15000,
});

const tmdbHeaders = () => ({
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
});

// API to get now playing movies from TMDB API
export const getNowPlayingMovies=async(req,res)=>{
    try {
       const { data } = await tmdbClient.get("/movie/now_playing", {
      headers: tmdbHeaders()
    });

        const movies=data.results;
        res.json({success:true,movies:movies})
    } catch (error) {
        console.error(error);
        res.json({success:false,message:error.message})
        
    }
}


// API to add a new show to database
export const addShow=async(req,res)=>{
    try {
        
        const {movieId,showsInput,showPrice}=req.body

        let movie=await Movie.findById(movieId);

        if(!movie){
            const [movieDetailsResponse,movieCreditsResponse]=await Promise.all([
                tmdbClient.get(`/movie/${movieId}`,{
        headers: tmdbHeaders() }),
        tmdbClient.get(`/movie/${movieId}/credits`,{
        headers: tmdbHeaders()
        }) ])

        const movieApiData=movieDetailsResponse.data;
        const movieCreditsData=movieCreditsResponse.data;

        const movieDetails={
        _id:movieId.toString(),
        title:movieApiData.title,
        overview:movieApiData.overview,
        poster_path:movieApiData.poster_path,
        backdrop_path:movieApiData.backdrop_path,
        release_date:movieApiData.release_date,
        original_language:movieApiData.original_language,
        tagline:movieApiData.tagline|| "",
        genres:movieApiData.genres,
        casts:movieCreditsData.cast.slice(0, 12),
        vote_average:movieApiData.vote_average,
        runtime:movieApiData.runtime,
        }

        //Add movie to the database
        movie=await Movie.create(movieDetails);

        }


        const showsToCreate=[];
        showsInput.forEach(show=>{
            const showDate=show.date;
            show.time.forEach((time)=>{
                const dateTimeString=`${showDate}T${time}` ;
                showsToCreate.push({
                    movie:movieId,
                    showDateTime:new Date(dateTimeString),
                    showPrice,
                    occupiedSeats:{},
                   isActive: true,

                })
            })
        });

        if(showsToCreate.length>0)
        {
            await Show.insertMany(showsToCreate)
        }


        await inngest.send({
            name: "app/show.added",
            data : {movieTitle: movie.title}
        })

        res.json({success:true,message:'Shows Added successfully. '})


    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}


//API TO GET ALL THE SHOWS FROM DATABASE
export const getShows=async(req,res)=>{
    try {
        const shows=await Show.find({showDateTime:{$gte:new Date()}}).populate('movie').sort({showDateTime:1});

        const uniqueShows=new Set(shows.map(show=>show.movie))

        res.json({success:true,shows:Array.from(uniqueShows.values())})
    } catch (error) {
        console.error(error);
        res.json({success:false,message:error.message})
        
    }
}

export const getShow=async(req,res)=>{
    try {
        const {movieId}=req.params;
        const shows=await Show.find({movie:movieId,showDateTime:{$gte: new Date() }})
        const movie=await Movie.findById(movieId);
        const dateTime={};
        shows.forEach((show)=>{
            const date=show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date]){
                dateTime[date]=[]
            }
            dateTime[date].push({time:show.showDateTime,showId:show._id})
        })
        res.json({success:true,movie,dateTime})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}
