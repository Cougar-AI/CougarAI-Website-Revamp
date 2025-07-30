import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom'

const Memberships = () => {
    return (
        <div 
            className="flex flex-col min-h-screen text-white bg-cover bg-center w-full"
            style={{ backgroundImage: "url('/bgphoto.jpg')" }}
        >
            <Navbar />
            <main className="flex-grow px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-8">Memberships</h1>

                <p className="max-w-3xl text-center text-lg mb-12">
                    Gain access to exclusive workshops, research projects, and rewards with a membership at CougarAI.
                </p>

                <p className="max-w-3xl text-center text-lg mb-12">
                    Our membership opens the door for all majors to having more opportunities to explore AI & Data Science.
                </p>

                <h2 className="text-3xl font-bold mb-10">Sign up today!</h2>
                <Link to="/Memberships">
                    <button className="font-bold bg-red-700 hover:bg-red-800 text-white py-3 px-9 rounded mb-16">
                        JOIN HERE
                    </button>
                </Link>

                <h3 className="text-2xl font-bold mb-10">PRICING</h3>
                <div className="flex justify-center gap-16 mt-8 mb-16">
                    <div className="bg-gray-300 text-black text-xl font-bold py-4 px-6 rounded-lg shadow-md">
                        $15 / Sem.
                    </div>
                    <div className=" text-white text-xl font-bold py-4 px-6 rounded-lg shadow-md">
                        OR
                    </div>
                    <div className="bg-gray-300 text-black text-xl font-bold py-4 px-6 rounded-lg shadow-md">
                        $25 / Year
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default Memberships;