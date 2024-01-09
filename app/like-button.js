'use client';
import { useState } from 'react';

export default function likeButton() {
    const [likes, setLikes] = React.useState(0);

    function handleClick() {
        //Incremement Likes by one
        setLikes(likes + 1);
    }
    return <button onClick={handleClick}>Like ({likes})</button>
}