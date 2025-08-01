import { ActionPanel, Action, Icon, List, showToast, Toast, Color } from "@raycast/api";
import { useState } from "react";
import { useCachedState } from "@raycast/utils";
import { findScreenMirroringDisplays, toggleDisplayMirroring, type ScreenDisplay } from "./utils/screenMirror";

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [screenList, setScreenList] = useCachedState<ScreenDisplay[]>("screen-displays", []);

  async function openDisplayMenuItem(displayTitle: string) {
    try {
      setIsLoading(true);

      const result = await toggleDisplayMirroring(displayTitle);

      if (result.success) {
        const isToggleOff = displayTitle.includes("(Currently Mirroring)");
        const cleanTitle = displayTitle.replace(" (Currently Mirroring)", "");

        showToast({
          style: Toast.Style.Success,
          title: isToggleOff ? "Screen Mirroring Stopped" : "Screen Mirroring Started",
          message: result.message || `${isToggleOff ? "Stopped mirroring to" : "Started mirroring to"} ${cleanTitle}`,
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to Toggle Display",
          message: result.error || "Could not interact with the display",
        });
      }
    } catch (error) {
      console.error("Failed to toggle display mirroring:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Failed to interact with display",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function findScreenMirroringMenuItem() {
    try {
      setIsLoading(true);

      const displays = await findScreenMirroringDisplays();

      if (displays.length > 0) {
        setScreenList(displays);

        showToast({
          style: Toast.Style.Success,
          title: "Screen Mirroring Menu Found!",
          message: `Found ${displays.length} display(s) in Control Center`,
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "Screen Mirroring Menu Not Found",
          message: "Could not locate the menu item or find any displays",
        });
      }
    } catch (error) {
      console.error("Failed to find screen mirroring menu:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Failed to search for menu item",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading}>
      {screenList.length > 0 ? (
        <List.Section title="Available Displays" subtitle={`${screenList.length} display(s) found`}>
          {screenList.map((display, index) => {
            const isCurrentlyMirroring = display.title.includes("(Currently Mirroring)");
            const displayTitle = display.title.replace(" (Currently Mirroring)", "");

            return (
              <List.Item
                key={`${display.title}-${index}`}
                icon={{
                  source: isCurrentlyMirroring
                    ? Icon.CheckCircle
                    : display.role === "AXCheckBox"
                      ? Icon.Monitor
                      : Icon.Desktop,
                  tintColor: isCurrentlyMirroring ? Color.Green : Color.SecondaryText,
                }}
                title={displayTitle}
                subtitle={isCurrentlyMirroring ? "Currently Mirroring • " + display.role : `Role: ${display.role}`}
                actions={
                  <ActionPanel>
                    <Action
                      title={isCurrentlyMirroring ? "Stop Mirroring" : "Start Mirroring"}
                      icon={isCurrentlyMirroring ? Icon.Stop : Icon.Play}
                      onAction={() => openDisplayMenuItem(displayTitle)}
                    />
                    <Action
                      title="Refresh Displays"
                      icon={Icon.ArrowClockwise}
                      onAction={findScreenMirroringMenuItem}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ) : (
        <List.Item
          key="find-menu"
          icon={Icon.Monitor}
          title="No Displays Found"
          subtitle="Click 'Refresh Displays' to search for available screen mirroring options"
          actions={
            <ActionPanel>
              <Action title="Refresh Displays" icon={Icon.ArrowClockwise} onAction={findScreenMirroringMenuItem} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
