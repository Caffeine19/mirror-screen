/**
 * Screen Mirroring Utility Functions
 * Contains Lua scripts for interacting with macOS Screen Mirroring via Hammerspoon
 */

import { callHammerspoon } from "./call-hammerspoon";

export interface ScreenDisplay {
  title: string;
  role: string;
}

export interface ScreenMirroringResult {
  found: boolean;
  title?: string;
  app?: string;
  displays?: ScreenDisplay[];
  displayTitles?: string[];
  displayCount?: number;
  error?: string;
}

export interface ToggleDisplayResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generates Lua code to find available screen mirroring displays
 * @returns Lua script string to discover displays in Control Center
 */
export function generateFindDisplaysLua(): string {
  return `
    -- Find the Screen Mirroring menu bar item and get available displays
    local axuielement = require("hs.axuielement")
    local application = require("hs.application")
    local logger = hs.logger.new('ScreenMirror', 'debug')
    
    -- Set log level to verbose to see all messages
    logger.setLogLevel('verbose')
    
    logger.i("🔍 Starting search for Screen Mirroring menu item...")
    
    -- Function to search all elements recursively for description match
    local function searchByDescription(element, depth)
      if not element or depth > 10 then return nil end
      
      local description = element:attributeValue("AXDescription")
      local role = element:attributeValue("AXRole")
      
      -- Check if this item has "Screen Mirroring" in description
      if description and description == "Screen Mirroring" then
        logger.i("✅ FOUND MATCH BY DESCRIPTION! Description: " .. description .. ", Role: " .. (role or "unknown"))
        return element
      end
      
      -- Recursively search children
      local children = element:attributeValue("AXChildren")
      if children then
        for _, child in ipairs(children) do
          local result = searchByDescription(child, depth + 1)
          if result then return result end
        end
      end
      
      return nil
    end
    
    -- Function to find mirror display options in the opened dialog
    local function findMirrorDisplays(element, depth)
      if not element or depth > 10 then 
        logger.w("⚠️  findMirrorDisplays: element is nil or depth > 10")
        return {} 
      end
      
      local displays = {}
      local title = element:attributeValue("AXTitle")
      local role = element:attributeValue("AXRole")
      local description = element:attributeValue("AXDescription")
      
      logger.d("🔎 findMirrorDisplays depth " .. depth .. ": title='" .. (title or "nil") .. "', role='" .. (role or "nil") .. "', description='" .. (description or "nil") .. "'")
      
      -- Look for toggle buttons that contain "Mirror" in the title
      if role == "AXButton" and title and string.find(title, "Mirror") then
        logger.i("🎯 Found mirror option: " .. title)
        table.insert(displays, {
          title = title,
          role = role
        })
      end
      
      -- Look for checkbox elements that represent display devices
      if role == "AXCheckBox" and description then
        logger.i("🖥️ Found display device: " .. description)
        table.insert(displays, {
          title = description,
          role = role
        })
      end
      
      -- Look for disclosure triangle elements that represent currently mirroring displays
      if role == "AXDisclosureTriangle" and description then
        logger.i("📱 Found current mirroring display: " .. description)
        table.insert(displays, {
          title = description .. " (Currently Mirroring)",
          role = role
        })
      end
      
      -- Recursively search children
      local children = element:attributeValue("AXChildren")
      if children then
        logger.d("📂 findMirrorDisplays: found " .. #children .. " children at depth " .. depth)
        for i, child in ipairs(children) do
          logger.v("👶 Processing child " .. i .. " of " .. #children)
          local childDisplays = findMirrorDisplays(child, depth + 1)
          for _, display in ipairs(childDisplays) do
            table.insert(displays, display)
          end
        end
      else
        logger.v("🚫 findMirrorDisplays: no children found at depth " .. depth)
      end
      
      logger.d("📊 findMirrorDisplays: returning " .. #displays .. " displays at depth " .. depth)
      return displays
    end
    
    -- Function to find the Control Center dialog window
    local function findControlCenterDialog(axApp)
      logger.i("🪟 findControlCenterDialog: starting search")
      local windows = axApp:attributeValue("AXWindows")
      if windows then
        logger.i("📋 findControlCenterDialog: found " .. #windows .. " windows")
        for i, window in ipairs(windows) do
          local windowTitle = window:attributeValue("AXTitle")
          local windowRole = window:attributeValue("AXRole")
          local windowSubrole = window:attributeValue("AXSubrole")
          logger.d("🏠 Window " .. i .. ": title='" .. (windowTitle or "nil") .. "', role='" .. (windowRole or "nil") .. "', subrole='" .. (windowSubrole or "nil") .. "'")
          
          -- Look for the Control Center dialog window
          if windowTitle and (windowTitle == "Control Center" or string.find(windowTitle, "Screen Mirroring")) then
            logger.i("🎯 Found Control Center dialog window by title!")
            return window
          end
          
          -- Also check if this is a system dialog
          if windowRole == "AXWindow" then
            logger.i("✅ Found AXWindow, returning it")
            return window
          end
        end
        logger.w("❌ findControlCenterDialog: no matching windows found")
      else
        logger.e("🚫 findControlCenterDialog: no windows found")
      end
      return nil
    end
    
    -- Check Control Center application
    local controlCenterApp = application.applicationsForBundleID("com.apple.controlcenter")[1]
    if controlCenterApp then
      logger.i("✅ Found Control Center application")
      local axApp = axuielement.applicationElement(controlCenterApp)
      if axApp then
        logger.i("🎯 Got Control Center AX element")
        local screenMirroringElement = searchByDescription(axApp, 0)
        if screenMirroringElement then
          logger.i("🖱️ Found Screen Mirroring element, clicking it...")
          
          -- Click on the Screen Mirroring menu item to open the menu
          screenMirroringElement:performAction("AXPress")
          
          -- Wait a moment for the dialog to appear
          hs.timer.usleep(500000) -- 0.5 seconds
          
          -- Find the Control Center dialog window
          logger.i("🔍 Searching for Control Center dialog window...")
          local dialogWindow = findControlCenterDialog(axApp)
          
          if dialogWindow then
            logger.i("✅ Found Control Center dialog, searching for mirror display options...")
            local displays = findMirrorDisplays(dialogWindow, 0)
            logger.i("📊 Total displays found: " .. #displays)

            local displayTitles = {}
            for i, display in ipairs(displays) do
              logger.d("🖥️ Display " .. i .. ": " .. display.title)
              table.insert(displayTitles, display.title)
            end
            logger.i("🎉 Final display titles: " .. table.concat(displayTitles, ", "))

            return hs.json.encode({
              found = true,
              title = "Screen Mirroring",
              app = "Control Center",
              displays = displays,
              displayTitles = displayTitles,
              displayCount = #displays
            })
          else
            logger.w("❌ Could not find Control Center dialog window")
            return hs.json.encode({
              found = true,
              title = "Screen Mirroring",
              app = "Control Center",
              error = "Dialog not found"
            })
          end
        else
          logger.e("🚫 Screen Mirroring element not found")
        end
      else
        logger.e("🚫 Could not get Control Center AX element")
      end
    else
      logger.e("🚫 Control Center application not found")
    end
    
    return hs.json.encode({found = false, error = "Screen Mirroring menu not found"})
  `;
}

/**
 * Generates Lua code to toggle a specific display's mirroring status
 * @param displayTitle - The title of the display to toggle
 * @returns Lua script string to toggle the specified display
 */
export function generateToggleDisplayLua(displayTitle: string): string {
  return `
    -- Find and click on a specific display menu item
    local axuielement = require("hs.axuielement")
    local application = require("hs.application")
    local logger = hs.logger.new('ScreenMirror', 'debug')
    
    logger.setLogLevel('verbose')
    logger.i("🔍 Looking for display: ${displayTitle}")
    
    -- Function to search all elements recursively for description match (Screen Mirroring button)
    local function searchByDescription(element, depth)
      if not element or depth > 10 then return nil end
      
      local description = element:attributeValue("AXDescription")
      local role = element:attributeValue("AXRole")
      
      -- Check if this item has "Screen Mirroring" in description
      if description and description == "Screen Mirroring" then
        logger.i("✅ FOUND SCREEN MIRRORING BUTTON! Description: " .. description .. ", Role: " .. (role or "unknown"))
        return element
      end
      
      -- Recursively search children
      local children = element:attributeValue("AXChildren")
      if children then
        for _, child in ipairs(children) do
          local result = searchByDescription(child, depth + 1)
          if result then return result end
        end
      end
      
      return nil
    end
    
    -- Function to search all elements recursively for the specific display
    local function searchByTitle(element, depth, targetTitle)
      if not element or depth > 10 then return nil end
      
      local title = element:attributeValue("AXTitle")
      local description = element:attributeValue("AXDescription")
      local role = element:attributeValue("AXRole")
      
      -- Check if this item matches our target display
      if (title and title == targetTitle) or (description and description == targetTitle) then
        logger.i("✅ FOUND TARGET DISPLAY! Title: " .. (title or "nil") .. ", Description: " .. (description or "nil") .. ", Role: " .. (role or "unknown"))
        return element
      end
      
      -- Recursively search children
      local children = element:attributeValue("AXChildren")
      if children then
        for _, child in ipairs(children) do
          local result = searchByTitle(child, depth + 1, targetTitle)
          if result then return result end
        end
      end
      
      return nil
    end
    
    -- Function to find the Control Center dialog window
    local function findControlCenterDialog(axApp)
      local windows = axApp:attributeValue("AXWindows")
      if windows then
        for i, window in ipairs(windows) do
          local windowTitle = window:attributeValue("AXTitle")
          local windowRole = window:attributeValue("AXRole")
          
          if windowTitle and (windowTitle == "Control Center" or string.find(windowTitle, "Screen Mirroring")) then
            return window
          end
          
          if windowRole == "AXWindow" then
            return window
          end
        end
      end
      return nil
    end
    
    -- Check Control Center application
    local controlCenterApp = application.applicationsForBundleID("com.apple.controlcenter")[1]
    if controlCenterApp then
      logger.i("✅ Found Control Center application")
      local axApp = axuielement.applicationElement(controlCenterApp)
      if axApp then
        -- First, find and click the Screen Mirroring button to open the dialog
        logger.i("🔍 Searching for Screen Mirroring button...")
        local screenMirroringElement = searchByDescription(axApp, 0)
        if screenMirroringElement then
          logger.i("🖱️ Found Screen Mirroring button, clicking it...")
          screenMirroringElement:performAction("AXPress")
          
          -- Wait a moment for the dialog to appear
          hs.timer.usleep(500000) -- 0.5 seconds
          
          -- Now find the Control Center dialog window
          logger.i("🔍 Searching for Control Center dialog window...")
          local dialogWindow = findControlCenterDialog(axApp)
          
          if dialogWindow then
            logger.i("✅ Found Control Center dialog, searching for target display...")
            local targetElement = searchByTitle(dialogWindow, 0, "${displayTitle}")
            
            if targetElement then
              logger.i("🖱️ Found target element, clicking it...")
              targetElement:performAction("AXPress")
              
              -- Wait a moment for the action to complete
              hs.timer.usleep(300000) -- 0.3 seconds
              
              -- Close the Control Center dialog by pressing Escape
              logger.i("🔐 Closing Control Center dialog with Escape key...")
              hs.eventtap.keyStroke({}, "escape")
              
              return hs.json.encode({
                success = true,
                message = "Clicked on " .. "${displayTitle}"
              })
            else
              logger.w("❌ Could not find target display element")
              return hs.json.encode({
                success = false,
                error = "Display element not found"
              })
            end
          else
            logger.w("❌ Control Center dialog not found after clicking Screen Mirroring button")
            return hs.json.encode({
              success = false,
              error = "Control Center dialog not found after opening"
            })
          end
        else
          logger.w("❌ Screen Mirroring button not found")
          return hs.json.encode({
            success = false,
            error = "Screen Mirroring button not found. Please ensure Control Center is accessible."
          })
        end
      else
        logger.e("🚫 Could not get Control Center AX element")
      end
    else
      logger.e("🚫 Control Center application not found")
    end
    
    return hs.json.encode({success = false, error = "Could not interact with display"})
  `;
}

/**
 * Finds available screen mirroring displays
 * @returns Promise<ScreenDisplay[]> - Array of available displays
 */
export async function findScreenMirroringDisplays(): Promise<ScreenDisplay[]> {
  try {
    const luaCode = generateFindDisplaysLua();
    const response = await callHammerspoon(luaCode);
    const result: ScreenMirroringResult = JSON.parse(response);

    if (result.found && result.displays) {
      return result.displays.map((display) => ({
        title: display.title,
        role: display.role,
      }));
    }

    return [];
  } catch (error) {
    console.error("Failed to find screen mirroring displays:", error);
    return [];
  }
}

/**
 * Toggles the mirroring status of a specific display
 * @param displayTitle - The title of the display to toggle
 * @returns Promise<ToggleDisplayResult> - Result of the toggle operation
 */
export async function toggleDisplayMirroring(displayTitle: string): Promise<ToggleDisplayResult> {
  try {
    const luaCode = generateToggleDisplayLua(displayTitle);
    const response = await callHammerspoon(luaCode);
    const result = JSON.parse(response);

    return {
      success: result.success || false,
      message: result.message,
      error: result.error,
    };
  } catch (error) {
    console.error("Failed to toggle display mirroring:", error);
    return {
      success: false,
      error: "Failed to interact with display",
    };
  }
}
