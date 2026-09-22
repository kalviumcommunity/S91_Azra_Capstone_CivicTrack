import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import ComplaintCard from "./components/ComplaintCard";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />

      <main>
        <Dashboard />

        <ComplaintCard
          title="Road damage near college"
          category="Roads"
          status="Pending"
        />

        <ComplaintCard
          title="Street light not working"
          category="Electricity"
          status="Resolved"
        />
      </main>

      <Footer />
    </>
  );
}

export default App;