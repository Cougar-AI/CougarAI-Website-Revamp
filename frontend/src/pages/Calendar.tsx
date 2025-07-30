import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Calendar = () => {
    return (
        <div 
            className="flex flex-col min-h-screen bg-cover bg-center w-full text-white"
            style={{ backgroundImage: "url('/bgphoto.jpg')" }}
        >
            <Navbar />
            <main className="flex-grow px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">

            </main>
            <Footer />
        </div>
    );
};

export default Calendar;