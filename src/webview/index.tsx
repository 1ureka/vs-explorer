import { startReactApp } from "@view/utils/ui";

import { readInitData } from "@view/store/init";
import { appStateStore } from "@view/store/data";
import { setupDependencyChain } from "@view/store/dependency";
import { registerAllShortcuts } from "@view/action/shortcuts";
import { registerContextMenu } from "@view/action/app";

import { Box, type SxProps } from "@mui/material";
import { LoadingDisplay } from "@view/layout/LoadingDisplay";
import { NavigationPanels } from "@view/layout/NavigationPanels";
import { NavigationBar } from "@view/layout/NavigationBar";
import { TableHead } from "@view/layout-table/TableHead";
import { TableBody } from "@view/layout-table/TableBody";
import { ActionBar } from "@view/layout/ActionBar";
import { ImageGrid } from "@view/layout-grid/ImageGrid";
import { ContextMenu } from "@view/layout-menu/ContextMenu";
import { PropertyDialog } from "@view/layout-property/PropertyDialog";
import { ShortcutsDialog } from "@view/layout-shortcuts/ShortcutsDialog";

const appClassName = {
  scrollContainer: "explorer-scroll-container",
  contentContainer: "explorer-content-container",
  layout: "explorer-layout",
  panelsStub: "explorer-left-panels-stub",
  panelsContainer: "explorer-left-panels-container",
};

const panelsWidth = 270;

const containerSx: SxProps = {
  position: "relative",
  height: "100dvh",
  width: "100dvw",
  overflow: "hidden",
  overflowX: "auto",

  [`& .${appClassName.contentContainer}`]: {
    position: "relative",
    height: 1,
    minWidth: 700,
  },

  [`& .${appClassName.layout}`]: {
    display: "grid",
    gridTemplateColumns: `auto 1fr`,
    height: 1,
    width: 1,
  },

  [`& .${appClassName.panelsStub}`]: {
    width: { xs: 0, md: panelsWidth },
    transition: "width 0.3s ease",
  },
  [`& .${appClassName.panelsStub}.collapsed`]: {
    width: { xs: 0, md: 0 },
  },

  [`& .${appClassName.panelsContainer}`]: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 1,
    width: panelsWidth,
    transition: "translate 0.3s ease",
    translate: "0%",
    zIndex: 1,
  },
  [`& .${appClassName.panelsContainer}.collapsed`]: {
    translate: "-100%",
  },
};

const App = () => {
  const showLeftPanel = appStateStore((state) => state.showLeftPanel);

  return (
    <Box className={appClassName.scrollContainer} sx={containerSx}>
      <div className={appClassName.contentContainer}>
        <div className={appClassName.layout}>
          <div className={`${appClassName.panelsStub} ${showLeftPanel ? "" : "collapsed"}`} />
          <div className={`${appClassName.panelsContainer} ${showLeftPanel ? "" : "collapsed"}`}>
            <NavigationPanels />
          </div>

          <Box sx={{ p: 1, display: "flex", flexDirection: "column", height: 1, minHeight: 0 }}>
            <NavigationBar />
            <TableHead />
            <TableBody />
            <ActionBar />
            <ImageGrid />
          </Box>
        </div>
        <LoadingDisplay />
        <ContextMenu />
        <PropertyDialog />
        <ShortcutsDialog />
      </div>
    </Box>
  );
};

startReactApp({
  App,
  beforeRender: () => {
    setupDependencyChain();
    readInitData();
    registerAllShortcuts();
    registerContextMenu();
  },
});
