import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import timeFormat from '../lib/timeFormat';
import { dateFormat } from '../lib/dateFormat';
import { useAppContext } from '../context/AppContext';

const MyBookings = () => {
  const { axios, getToken, user, image_base_url } = useAppContext();
  const location = useLocation();

  const currency = import.meta.env.VITE_CURRENCY;

  const [bookings, setbookings] = useState([]);
  const [isLoading, setisLoading] = useState(true);

  const getMyBookings = async () => {
    try {
      const { data } = await axios.get('/api/user/bookings', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (data.success) {
        setbookings(data.bookings);
      }
    } catch (error) {
      console.log(error);
    }
    setisLoading(false);
  };

  // 1) Initial load when user is ready
  useEffect(() => {
    if (user) {
      getMyBookings();
    }
  }, [user]);

  // 2) Refetch when Stripe redirects back with ?success=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isSuccess = params.get('success');

    if (user && isSuccess) {
      getMyBookings();
    }
  }, [location.search, user]);

  // Optional: refetch when window/tab regains focus (covers new-tab Stripe)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        getMyBookings();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  return !isLoading ? (
    <div className='relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh] '>
      <BlurCircle top='100px' left='100px' />
      <div>
        <BlurCircle bottom='0px' left='600px' />
      </div>
      <h1 className='text-lg font-semibold mb-4'>My Bookings</h1>

      {bookings.map((item, index) => (
        <div
          key={index}
          className='flex flex-col md:flex-row justify-between bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 max-w-3xl'
        >
          <div className='flex flex-col md:flex-row'>
            <img
              src={image_base_url + item.show.movie.poster_path}
              alt=''
              className='md:max-w-45 aspect-video h-auto object-cover object-bottom rounded'
            />
            <div className='flex flex-col p-4'>
              <p className='text-lg font-semibold'>{item.show.movie.title}</p>
              <p className='text-gray-400 text-sm'>
                {timeFormat(item.show.movie.runtime)}
              </p>
              <p className='text-gray-400 text-sm'>
                {dateFormat(item.show.showDateTime)}
              </p>
            </div>
          </div>

          <div className='flex flex-col md:items-end md:text-right justify-between p-4'>
            <div className='flex items-center gap-4'>
              <p className='text-2xl font-semibold mb-3'>
                {currency}
                {item.amount}
              </p>

              {/* Use <a> for external Stripe URL & hide when paid */}
              {!item.isPaid && item.paymentLink && (
                <a
                  href={item.paymentLink}
                  className='bg-primary px-4 py-1.5 mb-3 text-sm rounded-full font-medium cursor-pointer'
                >
                  Pay Now
                </a>
              )}
            </div>
            <div className='text-sm'>
              <p>
                <span className='text-gray-400'>Total Tickets </span>
                {item.bookedSeats.length}
              </p>
              <p>
                <span>Seat Number: </span>
                {item.bookedSeats.join(' , ')}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Loading />
  );
};

export default MyBookings;
