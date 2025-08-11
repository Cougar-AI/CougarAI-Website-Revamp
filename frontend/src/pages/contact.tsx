const Contact = () => {
    return (
        <div 
            className="flex flex-col min-h-screen bg-cover bg-center w-full text-white"
            style={{ backgroundImage: "url('/bgphoto.jpg')" }}
        >
            <main className="flex-grow px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">

                <p className="max-w-3xl text-center text-lg mb-12">
                    Whether you have a professional inquiry or a casual question, we are one email away!
                </p>

                <p className="max-w-3xl text-center text-lg mb-12">
                    Any questions can be sent to cougaraicontact@gmail.com
                </p>

                <h2 className="text-3xl font-bold mb-10">Sign up today!</h2>
            </main>
        </div>
    );
};

export default Contact;