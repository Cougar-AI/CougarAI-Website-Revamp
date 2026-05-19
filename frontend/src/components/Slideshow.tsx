import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Autoplay, Pagination } from 'swiper/modules'
// @ts-expect-error — swiper v11 CSS exports lack TS declarations
import 'swiper/css'
// @ts-expect-error — swiper v11 CSS exports lack TS declarations
import 'swiper/css/navigation'
// @ts-expect-error — swiper v11 CSS exports lack TS declarations
import 'swiper/css/pagination'
import './Slideshow.css'

const DEFAULT_IMAGES: SlideImage[] = [
  '/ss_img1.jpg',
  '/ss_img2.jpg',
  '/ss_img3.jpg',
  '/ss_img4.jpg',
  '/ss_img5.jpg',
]

export type SlideImage = string | { src: string; objectPosition?: string; caption?: string }

interface SlideshowProps {
  images?: SlideImage[];
  objectPosition?: string;
}

export default function Slideshow({ images = DEFAULT_IMAGES, objectPosition = 'center' }: SlideshowProps) {
  return (
    <div className="w-full max-w-5xl mx-auto aspect-[5/3]">
      <Swiper
        modules={[Navigation, Autoplay, Pagination]}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        loop
      >
        {images.map((image, i) => {
          const src = typeof image === 'string' ? image : image.src
          const pos = typeof image === 'string' ? objectPosition : (image.objectPosition ?? objectPosition)
          const caption = typeof image === 'string' ? undefined : image.caption
          return (
            <SwiperSlide key={src} style={{ position: 'relative' }}>
              <img
                src={src}
                alt={`Slide ${i + 1}`}
                className="w-full h-full object-cover"
                style={{ objectPosition: pos }}
              />
              {caption && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,.6))',
                  padding: '30px 20px 32px',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    fontFamily: 'Oxanium,sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,.92)',
                    textShadow: '0 1px 4px rgba(0,0,0,.6)',
                  }}>
                    {caption}
                  </span>
                </div>
              )}
            </SwiperSlide>
          )
        })}
      </Swiper>
    </div>
  )
}
