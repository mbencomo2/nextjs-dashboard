import { TodoItem } from "./TodoItem.jsx";

export function TodoList({ list, toggle, remove }) {
    return (
        <ul className="list">
            {list.length === 0 && "No Todos"}
            {list.map(todo => {
                return <TodoItem
                    key={todo.id}
                    id={todo.id}
                    title={todo.title}
                    completed={todo.completed}
                    toggle={toggle}
                    remove={remove}
                />;
            })}
        </ul>
    );
}