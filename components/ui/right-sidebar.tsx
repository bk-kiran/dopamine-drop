"use client";

import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface RightSidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const RightSidebarContext = createContext<RightSidebarContextProps | undefined>(
  undefined
);

export const useRightSidebar = () => {
  const context = useContext(RightSidebarContext);
  if (!context) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider");
  }
  return context;
};

export const RightSidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(true);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <RightSidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </RightSidebarContext.Provider>
  );
};

export const RightSidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <RightSidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </RightSidebarProvider>
  );
};

export const RightSidebarBody = ({ className, children, ...props }: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopRightSidebar className={className} {...props}>
        {children}
      </DesktopRightSidebar>
      <MobileRightSidebar {...(props as React.ComponentProps<"div">)}>
        {children}
      </MobileRightSidebar>
    </>
  );
};

export const DesktopRightSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useRightSidebar();

  return (
    <motion.div
      className={cn(
        "h-full hidden md:flex flex-col overflow-hidden shrink-0",
        "bg-white border-l border-gray-200 shadow-sm",
        "dark:bg-[#0F0A1E] dark:border-white/10 dark:shadow-none",
        className
      )}
      animate={{
        width: animate ? (open ? "350px" : "60px") : "350px",
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      {...props}
    >
      {/* Toggle button — inside sidebar at the top, above icons */}
      <div className={cn(
        "flex shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-white/10",
        open ? "justify-end" : "justify-center"
      )}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm",
            "bg-gray-100 border border-gray-300 text-gray-700",
            "hover:bg-purple-50 hover:border-purple-400 hover:text-purple-600",
            "dark:bg-neutral-800 dark:border-white/10 dark:text-gray-300",
            "dark:hover:bg-purple-900/30 dark:hover:border-purple-500 dark:hover:text-purple-400"
          )}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Scrollable content below toggle */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        {children}
      </div>
    </motion.div>
  );
};

export const MobileRightSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useRightSidebar();
  return (
    <div className="md:hidden" {...props}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed h-full w-full inset-0 p-8 z-[100] flex flex-col overflow-y-auto",
              "bg-white dark:bg-[#0F0A1E]",
              className
            )}
          >
            <div
              className="absolute right-6 top-6 z-50 p-2 rounded-lg cursor-pointer transition-colors text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const RightSidebarSection = ({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const { open, animate } = useRightSidebar();

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Collapsed: icon only, centered */}
      <motion.div
        animate={{
          display: animate ? (open ? "none" : "flex") : "none",
        }}
        className="items-center justify-center py-4"
      >
        <div className="text-purple-500 dark:text-purple-400">
          {icon}
        </div>
      </motion.div>

      {/* Expanded: full header + content */}
      <motion.div
        animate={{
          display: animate ? (open ? "block" : "none") : "block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="text-purple-500 dark:text-purple-400 shrink-0">
            {icon}
          </div>
          <h3 className="font-bold text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {title}
          </h3>
        </div>
        {children}
      </motion.div>
    </div>
  );
};
