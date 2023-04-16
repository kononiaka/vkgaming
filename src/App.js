import React, { useState } from "react";
import Layout from './Layout/Layout';
import GrafBanner from "./components/graf_banner/graf_banner";

import classes from './App.module.css';


function App() {
  const [showGraf, setShowGraf] = useState(false);

  const handleGrafClick = () => {
    setShowGraf(true);
  };

  const helpCloseHandler = () => {

  };

  return (
    <div className={classes.main}>
      <Layout>
        <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner >
      </Layout>
    </div>
  );
}

export default App;
