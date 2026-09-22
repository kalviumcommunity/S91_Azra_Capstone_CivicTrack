function ComplaintCard({ title, category, status }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>Category: {category}</p>
      <p>Status: {status}</p>
    </div>
  );
}

export default ComplaintCard;