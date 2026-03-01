import { memo, Fragment } from "react";
import { Box, Typography } from "@mui/material";
import { Dialog } from "@view/components/Dialog";
import { ActionButton, ActionGroup } from "@view/components/Action";
import { appStateStore } from "@view/store/data";
import { closeShortcutsDialog } from "@view/action/app";
import { shortcutsByCategory, shortcutDialogSx } from "@view/layout-shortcuts/config";

/**
 * 快捷鍵項目的鍵帽顯示
 */
const ShortcutKeys = ({ keys }: { keys: string[] }) => (
  <Box sx={{ display: "flex", gap: 0.25, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
    {keys.map((key, index) => (
      <Fragment key={key}>
        <Box
          sx={{
            borderRadius: 1,
            border: "1px solid",
            borderColor: "tooltip.border",
            boxShadow: "0 1px 4px var(--vscode-widget-shadow)",
            px: 0.75,
            py: 0.125,
            minWidth: 24,
            textAlign: "center",
          }}
        >
          <Typography variant="caption" sx={{ fontFamily: "var(--vscode-editor-font-family)" }}>
            {key}
          </Typography>
        </Box>
        {index < keys.length - 1 && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            +
          </Typography>
        )}
      </Fragment>
    ))}
  </Box>
);

/**
 * 快捷鍵對話框元件，以表格方式靜態呈現所有可用的快捷鍵與觸發時機
 */
const ShortcutsDialog = memo(() => {
  const open = appStateStore((state) => state.showShortcutsDialog);

  return (
    <Dialog open={open} onClose={closeShortcutsDialog}>
      <Box sx={shortcutDialogSx}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <i className="codicon codicon-keyboard" style={{ fontSize: 20 }} />
          <Typography variant="body1" fontWeight="bold">
            快捷鍵一覽
          </Typography>
        </Box>

        {shortcutsByCategory.map(({ category, entries }) => (
          <Fragment key={category}>
            <div className="shortcut-category-title">{category}</div>
            {entries.map((entry) => (
              <div className="shortcut-row" key={entry.description}>
                <div className="shortcut-description">{entry.description}</div>
                <ShortcutKeys keys={entry.keys} />
                <div className="shortcut-context">{entry.context}</div>
              </div>
            ))}
          </Fragment>
        ))}

        <Typography variant="caption" sx={{ color: "text.secondary", mt: 1 }}>
          在任何輸入框中聚焦時，上述快捷鍵將不會觸發。
        </Typography>
      </Box>

      <Box sx={{ position: "absolute", inset: "0px 0px auto auto", p: 1.5 }}>
        <ActionGroup size="small">
          <ActionButton actionIcon="codicon codicon-close" actionName="關閉" onClick={closeShortcutsDialog} />
        </ActionGroup>
      </Box>
    </Dialog>
  );
});

export { ShortcutsDialog };
