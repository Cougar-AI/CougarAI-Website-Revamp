import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Autoplay } from 'swiper/modules'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — swiper v11 CSS exports lack TS declarations
import 'swiper/css'
// @ts-ignore
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
    <div className="w-full max-w-5xl mx-auto aspect-[5/3]">
      <Swiper modules={[Navigation, Autoplay]} navigation autoplay={{ delay: 5000, disableOnInteraction: false }} loop>
        {images.map((src, i) => (
          <SwiperSlide key={src}>
            <img src={src} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}