
function ComplaintCard({ title, category, status, onEdit, onDelete }) {
  return (
    <div>
      <h3>{title}</h3>

      <p>Category: {category}</p>
      <p>Status: {status}</p>

      <button type="button" onClick={onEdit}>
        Edit
      </button>

      <button type="button" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

export default ComplaintCard;
