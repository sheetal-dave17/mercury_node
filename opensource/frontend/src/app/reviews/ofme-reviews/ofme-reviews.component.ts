// reviews current user has left on others

import { reviewURL } from './../write-review/write-review.component';
import { ActivatedRoute } from '@angular/router';
import { Http } from '@angular/http';
import { GlobalService } from './../../utils/global.service';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ofme-reviews',
  templateUrl: './ofme-reviews.component.html',
  styleUrls: ['./ofme-reviews.component.css']
})
export class OfmeReviewsComponent implements OnInit {
    reviews = [];
    myAddress = this.gs.wallet.address;
    othersAddress;
    rating = 0;
    constructor(
        private gs: GlobalService,
        private http: Http,
        private route: ActivatedRoute
    ) {
        route.params.subscribe(data => {
            this.othersAddress = data['address'];
        })

    }
    ngOnInit() {
        this.gs.reviewSeen.emit();
        console.log('get ' + 'reviewsOfme/'+this.myAddress);
        this.http.get(reviewURL + 'reviewsOfme/'+this.myAddress).map(res => res.json()).subscribe(res => {
            console.log('res ' + 'reviewsOfme/', res);
            this.reviews = res;
            this.reviews.forEach((item, index) => {
                this.rating += item.stars
            })
            this.rating = this.rating / this.reviews.length;
        });
    }
}