import { useCallback, useEffect, useState } from "react";
import { usePop } from "../context/Pop.jsx";
import { useToast } from "../context/Toast.jsx";
import { downloadFile } from "../lib/download.js";

function ImageView({ blob, filename, title, caption }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return (
    <>
      {url && <img className="pop-img" src={url} alt={title} />}
      <p className="note">{caption}</p>
      <div className="row"><button className="btn" onClick={() => downloadFile(filename, blob)}>Save image</button></div>
    </>
  );
}

// showImage(canvas, "file.png", "Title", "Caption") opens the image in a popup with a Save button.
export function useShowImage() {
  const { openPop } = usePop();
  const toast = useToast();
  return useCallback((canvas, filename, title, caption) => {
    canvas.toBlob((blob) => {
      if (!blob) { toast("Couldn't create the image."); return; }
      openPop(title, <ImageView blob={blob} filename={filename} title={title} caption={caption} />);
    }, "image/png");
  }, [openPop, toast]);
}
