<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SpaController extends Controller
{
    /**
     * Handle all non-API routes and return the React SPA view.
     *
     * This controller ensures that React Router (client-side) 
     * handles navigation while Laravel only serves the initial app shell.
     */
    public function index(Request $request)
    {
        return view('app');
    }
}
