"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import { signOut, getCurrentUser } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "../home.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function HomePage() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [user, setUser] = useState<any>(null);

  function listTodos() {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }

  useEffect(() => {
    listTodos();
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // ユーザーがログインしていない場合はログイン画面にリダイレクト
      window.location.href = "/";
    }
  }

  function createTodo() {
    const content = window.prompt("Todo content");
    if (content) {
      client.models.Todo.create({
        content: content,
      });
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  function deleteTodo(id: string) {
    client.models.Todo.delete({ id });
  }

  return (
    <main className="home-container">
      <header className="home-header">
        <h1>Biory - ホーム</h1>
        <div className="user-info">
          <span>ようこそ、{user?.signInDetails?.loginId || 'ユーザー'}さん</span>
          <button onClick={handleSignOut} className="signout-button">
            ログアウト
          </button>
        </div>
      </header>

      <div className="home-content">
        <section className="todo-section">
          <h2>今日のやることリスト</h2>
          <button onClick={createTodo} className="add-todo-button">
            + 新しいタスクを追加
          </button>
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className="todo-item">
                <span>{todo.content}</span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="delete-button"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="wellness-section">
          <h2>今日の健康記録</h2>
          <div className="wellness-cards">
            <div className="wellness-card">
              <h3>🍽️ 食事</h3>
              <p>バランスの良い食事を心がけましょう</p>
            </div>
            <div className="wellness-card">
              <h3>💪 運動</h3>
              <p>適度な運動で体を動かしましょう</p>
            </div>
            <div className="wellness-card">
              <h3>😴 睡眠</h3>
              <p>質の良い睡眠を取りましょう</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
