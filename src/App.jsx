import { useState, useEffect } from "react";
import { NewTodoForm } from "./NewTodoForm.jsx";
import { TodoList } from "./TodoList.jsx";
import './normalize.css';
import './app.css';

export default function App() {
  const [todos, setTodos] = useState(() => {
    const localValue = localStorage.getItem("ITEMS");
    if (localValue == null) return [];
    return JSON.parse(localValue);
  });

  useEffect(() => { localStorage.setItem("ITEMS", JSON.stringify(todos)) }, [todos])

  function addTodo(title) {
    setTodos(currentTodos => {
      return [
        ...currentTodos,
        { id: crypto.randomUUID(), title, completed: false }
      ]
    })
  }

  function toggleTodo(id, checked) {
    setTodos(currentTodos => {
      const targetTodo = currentTodos.find(todo => id === todo.id);
      targetTodo.completed = checked;
      return [...currentTodos];
    });
  }

  function deleteTodo(id) {
    setTodos(currentTodos => {
      const newTodos = currentTodos.filter(todo => id != todo.id);
      return [...newTodos];
    });
  }

  return (
    <>
      <h1 className="header">ToDo List</h1>
      <NewTodoForm onSubmit={addTodo} />
      <TodoList list={todos} toggle={toggleTodo} remove={deleteTodo} />
    </>
  );
}