"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const defaultTextColor = 'text-gray-300';
  const hoverTextColor = 'text-white';
  const textSizeClass = 'text-sm';

  return (
    <Link
      href={href}
      className={`group relative inline-block overflow-hidden h-5 flex items-center ${textSizeClass}`}
    >
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
        <span className={defaultTextColor}>{children}</span>
        <span className={hoverTextColor}>{children}</span>
      </div>
    </Link>
  );
};

export function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Handle scroll behavior - hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show navbar at the very top
      if (currentScrollY < 10) {
        setIsVisible(true);
      }
      // Hide when scrolling down
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        setIsOpen(false); // Close mobile menu when hiding
      }
      // Show when scrolling up
      else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Handle mobile menu shape transition
  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  // dopamine drop logo - purple gradient circle
  const logoElement = (
    <Link href="/" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
        <span className="text-white font-bold text-sm">DD</span>
      </div>
      <span className="hidden sm:block text-white font-semibold text-sm">dopamine drop</span>
    </Link>
  );

  const navLinksData = [
    { label: 'Features', href: '#features' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'About', href: '#about' },
  ];

  const loginButtonElement = (
    <Link
      href="/login"
      className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-white/10 bg-white/5 text-gray-300 rounded-full hover:border-purple-500/50 hover:text-white hover:bg-white/10 transition-all duration-200 w-full sm:w-auto text-center"
    >
      Sign In
    </Link>
  );

  const signupButtonElement = (
    <div className="relative group w-full sm:w-auto">
      {/* Glow effect */}
      <div className="absolute inset-0 -m-2 rounded-full
                      hidden sm:block
                      bg-purple-500
                      opacity-40 filter blur-lg pointer-events-none
                      transition-all duration-300 ease-out
                      group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3">
      </div>
      {/* Button */}
      <Link
        href="/signup"
        className="relative z-10 px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-500 rounded-full hover:from-purple-500 hover:to-purple-400 transition-all duration-200 w-full sm:w-auto block text-center"
      >
        Get Started
      </Link>
    </div>
  );

  return (
    <header
      className={`fixed left-1/2 transform -translate-x-1/2 z-50
                  flex flex-col items-center
                  px-6 py-3 backdrop-blur-md
                  ${headerShapeClass}
                  border border-white/10 bg-black/40
                  w-[calc(100%-2rem)] sm:w-auto
                  transition-all duration-300 ease-in-out
                  shadow-lg shadow-black/20
                  ${isVisible ? 'top-6 opacity-100' : '-top-24 opacity-0'}`}
    >
      {/* Desktop/Mobile Top Row */}
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        {/* Logo */}
        <div className="flex items-center">
          {logoElement}
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.href} href={link.href}>
              {link.label}
            </AnimatedNavLink>
          ))}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {loginButtonElement}
          {signupButtonElement}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none hover:text-white transition-colors"
          onClick={toggleMenu}
          aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <div
        className={`md:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                    ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}
      >
        {/* Mobile Nav Links */}
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-gray-300 hover:text-white transition-colors w-full text-center"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Auth Buttons */}
        <div className="flex flex-col items-center space-y-3 mt-4 w-full">
          {loginButtonElement}
          {signupButtonElement}
        </div>
      </div>
    </header>
  );
}
