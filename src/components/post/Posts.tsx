"use client";
import React, { useState, useEffect } from "react";
import PostCard from "./PostCard";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/supabaseClient";
import { toast } from "react-toastify";
import { useInView } from "react-intersection-observer";
import Loading from "@/app/(front)/loading";

export default function Posts({
  data,
  user,
  totalPosts,
}: {
  data: Array<PostType> | [];
  user: User;
  totalPosts: number;
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState(data);
  const limit = 5;
  const [page, setPage] = useState(1);
  const [noMoreData, setNoMoreData] = useState(false);

  const { ref, inView } = useInView({
    threshold: 0,
  });

  useEffect(() => {
    if (inView) {
      fetchMorePosts();
    }
  }, [inView]);

  useEffect(() => {
    const postChannel = supabase.channel("postsChannel");

    postChannel
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          console.log("The delete payload is", payload);
          const filterPosts = posts.filter(
            (item) => item.post_id !== payload.old?.id
          );
          setPosts(filterPosts);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        async (payload) => {
          const { data: postUser } = await supabase
            .from("users")
            .select("id,name,email,username,profile_image")
            .eq("id", payload.new?.user_id)
            .single();
          const data: PostType = {
            post_id: payload.new?.id,
            user_id: payload.new?.user_id,
            content: payload.new?.content,
            image: payload.new?.image,
            likes_count: payload.new?.likes_count,
            reply_count: payload.new?.reply_count,
            created_at: payload.new?.created_at,
            email: postUser?.email!,
            liked: false,
            name: postUser?.name,
            username: postUser?.username,
            profile_image: postUser?.profile_image,
          };
          setPosts([data, ...posts]);
        }
      )
      .subscribe();

    return () => {
      postChannel.unsubscribe();
    };
  }, []);

  const fetchMorePosts = async () => {
    let from = page * limit;
    let to = from + limit;
    if (from > totalPosts) {
      setNoMoreData(true);
      return;
    }
    const { data, error } = await supabase
      .rpc(
        "get_posts_with_likes",
        {
          request_user_id: user.id,
        },
        { count: "exact" }
      )
      .order("post_id", { ascending: false })
      .range(from, to);

    setPage(page + 1);
    if (error) {
      toast.error("Something went wrong.while fatching more posts", {
        theme: "colored",
      });
      return;
    }

    const morePosts: Array<PostType> | [] = data;

    if (morePosts && morePosts.length > 0) {
      setPosts([...posts, ...morePosts]);
    } else {
      setNoMoreData(true);
    }
  };

  return (
    <div>
      {posts.length > 0 &&
        posts.map((item: PostType, index: number) => (
          <PostCard post={item as PostType} key={index} user={user} />
        ))}

      {!noMoreData && (
        <div ref={ref}>
          <Loading />
        </div>
      )}

      {noMoreData && <p className="text-center">No more posts to fetch!!</p>}
    </div>
  );
}
