import React, { useEffect, useState } from 'react'
import { dummyShowsData } from '../../assets/assets';
import Loading from '../../components/Loading';
import Ttile from '../../components/admin/Ttile';
import { dateFormat } from '../../lib/dateFormat';
import { useAppContext } from '../../context/AppContext';

const ListShows = () => {

    const {axios,getToken,user} = useAppContext()

    const currency=import.meta.env.VITE_CURRENCY;

    const [shows,setshows]=useState([]);
    const [loading,setloading]=useState(true);

    const getAllShows=async()=>{
        try{
        const {data}=await axios.get('/api/admin/all-shows',{headers:{Authorization:`Bearer ${await getToken()}`}})
        setshows(data.shows)
        setloading(false);
        }
        catch(error){
           console.error(error);
           
        }
    }

    useEffect(()=>{
      if(user){ 
      getAllShows();}
    },[user])


  return !loading?(
    <div>
      <Ttile text1="List" text2="Shows"/>

      <div className='max-w-4xl mt-6 overflow-x-auto'>
        <table className='w-full border-collapse rounded-md overflow-hidden text-nowrap'>
                <thead>
                    <tr className='bg-primary/20 text-left text-white'>
                        <th className='p-2 font-medium'>Movie Name</th>
                        <th className='p-2 font-medium'>Show Time</th>
                        <th className='p-2 font-medium'>Total Bookings</th>
                        <th className='p-2 font-medium'>Earnings</th>
                    </tr>
                </thead>
                <tbody className='text-sm font-light'>
                    {shows.map((show,index)=>(
                        <tr key={index} className='border-b border-primary/10 bg-primary/5 even:bg-primary/10'>
                             <td className='p-2 min-w-45 pl-5'>{show.movie.title}</td>
                             <td className='p-2 '>{dateFormat(show.showDateTime)}</td>
                             <td className='p-2 '>{Object.keys(show.occupiedSeats).length}</td>
                             <td className='p-2 '>{currency}{Object.keys(show.occupiedSeats).length*show.showPrice}</td>
                        </tr>
                    ))}
                </tbody>
        </table>
      </div>
    </div>
  ) : <Loading />
}

export default ListShows
