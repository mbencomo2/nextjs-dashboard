export function TodoItem({ id, title, completed, toggle, remove }) {
    return (
        <li>
            <label htmlFor="list-item">
                <input
                    type="checkbox"
                    id="list-item"
                    checked={completed}
                    onChange={e => toggle(id, e.target.checked)}
                />
            </label>
            {title}
            <button
                className="btn btn-delete"
                onClick={() => remove(id)}
            >
                Delete
            </button>
        </li>
    );
}