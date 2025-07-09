import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import './Slideshow.css'

const images = [
    '/ss_img1.jpg',
    '/ss_img2.jpg',
    '/ss_img3.jpg',
    '/ss_img4.jpg',
    '/ss_img5.jpg'
]

export default function Slideshow() {
    return (
        <div style={{ width: '600px', height: '400px' }}>
            <Swiper 
                modules={[Navigation, Autoplay]}
                navigation
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                loop
                style={{ width: '100%', height: '100%' }}
            >
                {images.map((src, i) => (
                    <SwiperSlide key={i}>
                        <img src={src} alt={'Slide ${I + 1}'} style={{ width: '100%', objectFit: 'cover' }} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    )
}