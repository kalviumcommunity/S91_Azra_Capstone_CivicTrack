
import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import ComplaintCard from "./components/ComplaintCard";
import Footer from "./components/Footer";

const API_URL = "http://localhost:5001";

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

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleGoogleSuccess(response) {
    if (!response.credential) {
      setMessage("Google did not return a credential.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Google login failed.");
      }

      setUser(data.user);
      setMessage("Google login successful!");

      // Store the app's JWT, not Google's ID credential.
      sessionStorage.setItem("civicTrackToken", data.token);
    } catch (error) {
      setMessage(error.message || "Unable to sign in with Google.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setMessage("Google sign-in was cancelled or failed.");
  }

  function handleLogout() {
    sessionStorage.removeItem("civicTrackToken");
    setUser(null);
    setMessage("You have been signed out.");
  }

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
        <section
          style={{
            maxWidth: "420px",
            margin: "24px auto",
            padding: "20px",
            textAlign: "center",
          }}
        >
          {user ? (
            <>
              <h2>Welcome, {user.name}!</h2>
              <p>{user.email}</p>
              <button type="button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <h2>Sign in to CivicTrack</h2>
              <p>Use your Google account to continue.</p>

              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />

              {loading && <p>Signing in...</p>}
            </>
          )}

          {message && <p role="status">{message}</p>}
        </section>

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
