
import { useState } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import ComplaintCard from "./components/ComplaintCard";
import Footer from "./components/Footer";

function App() {
  const [complaints, setComplaints] = useState([
    {
      id: 1,
      title: "Road damage near college",
      category: "Roads",
      status: "Pending",
    },
    {
      id: 2,
      title: "Street light not working",
      category: "Electricity",
      status: "Resolved",
    },
  ]);

  function handleEdit(id) {
    const complaint = complaints.find((item) => item.id === id);

    if (!complaint) return;

    const newTitle = window.prompt(
      "Enter updated complaint title:",
      complaint.title
    );

    if (newTitle === null || newTitle.trim() === "") return;

    setComplaints((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, title: newTitle.trim() }
          : item
      )
    );
  }

  function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this complaint?"
    );

    if (!confirmed) return;

    setComplaints((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  return (
    <>
      <Navbar />

      <main>
        <Dashboard />

        {complaints.map((complaint) => (
          <ComplaintCard
            key={complaint.id}
            title={complaint.title}
            category={complaint.category}
            status={complaint.status}
            onEdit={() => handleEdit(complaint.id)}
            onDelete={() => handleDelete(complaint.id)}
          />
        ))}
      </main>

      <Footer />
    </>
  );
}

export default App;
