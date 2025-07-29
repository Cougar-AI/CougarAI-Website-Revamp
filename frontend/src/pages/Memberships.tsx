import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Memberships = () => {
    return (
        <div 
            className="text-white bg-cover bg-center min-h-screen w-full"
            style={{ backgroundImage: "url('/bgphoto.jpg')" }}
        >
            <Navbar />
            <main className="px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">About CougarAI</h1>
                <p className="max-w-3xl text-center text-lg">
                    CougarAI is a student-led organization focused on AI and ML education through workshops,
                    research projects, and community collaboration.
                </p>
            </main>
            <Footer />
        </div>
    );
};

export default Memberships;